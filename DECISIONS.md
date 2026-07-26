# TaskBid — Architecture Decisions

This document covers Parts A–D of the assignment's required write-up, a condensed architecture rationale, and the explicit MongoDB/MERN stack-deviation note. The full blueprint documents are at `docs/TaskBid_Implementation_Blueprint_MERN.md` and `docs/TaskBid_Implementation_Architecture_MERN.md`.

---

## Part A — Concurrency: The `/assign` Race Condition

### The problem

Two managers trigger `POST /api/tasks/:id/assign` on two different tasks at the same moment. Both tasks happen to have the same user — call them Bilal — as their lowest-hours bidder. Bilal has 2 hours of remaining capacity. Each assignment would commit 2 hours to Bilal. If both succeed, Bilal ends up 4 hours over capacity with zero remaining slack.

This is the core race condition the assignment engine must prevent.

### Why a transaction alone does not close it

It is tempting to assume that wrapping the assignment in a MongoDB multi-document transaction is sufficient. It is not, and the Architecture Blueprint (Phase 7) states this explicitly.

Here is why: MongoDB's snapshot-isolation transactions prevent dirty reads within a single transaction — each transaction sees a consistent snapshot of the database as of when it started. But two concurrent transactions that both start before either has committed will both read the same `currentWorkloadHours` value for Bilal. Both see "13h used, 15h max, 2h remaining." Both conclude he has capacity. Both proceed to write. Both commit. Bilal is now at 17h against a 15h maximum.

The transaction gave each call internal atomicity. It did not serialise the two calls' reads against each other. That is the gap the version check closes.

### The two-part mechanism

**Part 1 — MongoDB transaction** with `readConcern: 'snapshot'` and `writeConcern: { w: 'majority' }`. This ensures everything inside one `/assign` call is atomic: if the task status update, the workload increment, the bid status updates, and the audit writes all succeed, they all commit together; if anything fails, nothing is visible. This is necessary but not sufficient.

**Part 2 — Version-conditioned `findOneAndUpdate` on `capacityVersion`**. The `users` collection has a `capacityVersion` integer field that starts at 0 and is incremented by 1 on every workload write. Inside the transaction, after concluding that Bilal has sufficient capacity, the engine does not blindly increment his workload. It issues:

```
findOneAndUpdate(
  { _id: bilalId, capacityVersion: versionReadEarlierInThisTransaction },
  { $inc: { currentWorkloadHours: hoursOffered, capacityVersion: 1 } },
  { session, new: true }
)
```

If `capacityVersion` has changed since the read — because a concurrent transaction already won and committed — this update matches zero documents and returns `null`. The engine treats `null` as a conflict signal. It aborts the current transaction and starts over from the beginning: re-fetches the task, re-fetches all bids in ascending order, re-evaluates every candidate from scratch. It retries up to 3 times before returning a 503 to the caller.

The critical detail is **restart from the top, not advance to the next bidder**. After a concurrent winner has committed, the entire candidate pool may be stale. Bilal might now be over capacity; the next-lowest bidder might also have been claimed by a different concurrent call. Restarting with fresh data is the only correct response.

### TransientTransactionError

MongoDB can also throw a `TransientTransactionError` when two transactions contend at the engine level. The assignment engine catches this via `err.hasErrorLabel('TransientTransactionError')` and routes it into the same bounded retry loop with an identical restart-from-top behaviour.

### Verified test results

**Feature 09** (TRACKING.md row 09): 10 concurrent-pair runs, all 10 passed.
- Bilal's `currentWorkloadHours` went from 13h to 15h in every run — never 17h.
- `capacityVersion` incremented by exactly 1 in every run — never 2.
- The retry path was triggered in every single run, confirmed by server log lines: `[assign] Retry 1/3 after transient transaction error: Write conflict during plan execution` appeared twice per run (once per concurrent call), for 20 total log lines across 10 runs.

**Feature 17** (TRACKING.md row 17, §4): 5 combined runs through the full stack — same backend result, plus both browser tabs received the `task:assigned` Socket.IO event without a manual page refresh in every run.

In the `[200,200]` outcome observed in these runs: Task X was assigned to Bilal (the winning transaction), and Task Y was assigned to Ayesha (the fallback bidder, after Bilal's capacity was found exhausted on retry). `capacityVersion` incremented by 1 — confirming only one call touched Bilal's document, not two.

---

## Part B — Stale Bid / Bid-Time vs. Assignment-Time Capacity

### Two separate checks, deliberately

There are two capacity checks in this system and they serve different purposes.

**Bid-time check (advisory):** when `POST /api/tasks/:id/bids` is called, `hasCapacityFor(currentUser, hoursOffered)` is evaluated using the user's current `currentWorkloadHours` and `maxCapacityHours`. If the bid would exceed remaining capacity, the request is rejected with 422. This check is soft and advisory: it prevents obviously over-budget bids at submission time, giving immediate feedback to the bidder.

It is not authoritative. Between the moment a bid is placed and the moment `POST /api/tasks/:id/assign` is called, the bidder's workload may change — they may be assigned to other tasks in the interim. A bid that was valid at placement time may be stale by assignment time.

**Assignment-time check (authoritative):** the assignment engine re-evaluates capacity inside the transaction, using a fresh read of the user document within the session. This is the definitive check. Even if the bid-time check passed, if the bidder's capacity has been consumed by the time assignment runs, they are skipped.

This split is documented in Architecture Blueprint Phase 4 (Assumption #3: *"bid-time vs. assignment-time tension is stack-independent, carried over unchanged"*) and in Feature 07's service design. The stale-bid scenario was explicitly tested in Feature 14: Hina's workload was raised server-side between page load and bid submission, the 422 was returned, and the frontend displayed the corrected remaining capacity retrieved by a post-422 workload refetch.

### Why not just check at assignment time only?

A bid-time check gives the bidder immediate, specific feedback: "you don't have the capacity for this." Without it, users could submit bids they can never win, cluttering the bid list and giving no useful signal until assignment is triggered. The two-check design preserves immediate UX feedback without removing the authoritative safety net.

---

## Part C — Dashboard Aggregation Pipeline Design

> *Note: the project's blueprint documents do not explicitly name Part C's specific topic for this assignment. The section below uses the dashboard aggregation-pipeline design as the best-fit content based on Architecture Blueprint Phase 16, which explicitly flags this as something that "must be documented in README later either way." If the original assignment brief assigns a different topic to Part C, this section should be replaced accordingly.*

### Four pipelines, run in parallel

`GET /api/dashboard/stats` returns four distinct aggregated metrics. Each is computed by its own aggregation pipeline, and all four are run in a single `Promise.all()` call:

1. **Tasks by status** — `$group` by `status` field, `$sort` ascending.
2. **Average bid hours per complexity level** — starts from the `bids` collection, `$lookup` to join the parent task document, `$unwind`, `$group` by `task.complexity` with `$avg` on `hoursOffered`, `$round` to 2 decimal places, `$sort` by complexity.
3. **Top 3 users by completed task count** — `$match` on `status: 'done'` and `assignedUser` not null, `$group` by `assignedUser` with `$sum: 1`, `$sort` descending, `$limit: 3`, `$lookup` to attach the user's name.
4. **Tasks with zero bids past their deadline** — `$match` on `deadline < now`, `$lookup` to join bids, `$match` on empty bids array, `$sort` by deadline ascending.

### Why four separate pipelines rather than one combined pipeline

Architecture Blueprint Phase 16 documents this explicitly: "readability + independent index usage over marginal round-trip savings." Each pipeline is backed by its own index (`status` index for pipeline 1, `{ task, hoursOffered }` compound index for pipeline 2, `status` + `assignedUser` for pipeline 3, `deadline` index for pipeline 4). A single combined pipeline would not benefit from all four indexes simultaneously — MongoDB can only use one index per pipeline stage. Running four targeted pipelines in parallel is both more readable and at least as efficient given the data volume.

The `Promise.all()` means the four pipelines run concurrently against the database, so the total latency is the slowest of the four, not their sum.

### Verified baseline values (fresh seed)

All four metrics were verified against direct database queries during Feature 10 and confirmed still accurate during Feature 17 §6:
- `tasksByStatus`: assigned:1, bidding_closed:1, done:3, draft:1, in_progress:1, open:2, review:1 (total: 10)
- `avgBidByComplexity`: C1=3h, C2=5.5h, C3=4h, C4=6.5h, C5=3.33h
- `topUsersByCompleted`: Sara Malik (2 tasks), Usman Tariq (1 task)
- `zeroBidPastDeadline`: "Archive old customer records" (deadline 2026-07-23)

---

## Part D — Audit Log Design: Why Explicit Service Calls, Not Hooks

### The three candidate approaches

When designing how mutation events get recorded in the `auditlogs` collection, there are three plausible patterns in a MongoDB/Mongoose stack:

**Option 1 — Mongoose `post('save')` / `post('findOneAndUpdate')` hooks on the Task and Bid models.** A hook fires automatically after a document is saved, requires no change to service code, and cannot be forgotten. This is the closest Mongoose-native approximation to a database trigger.

**Option 2 — An explicit service call: `audit.service.js`'s `recordChange()`.** The service layer calls this function explicitly after each mutation succeeds. It is more verbose but makes the audit write visible in the code that performs the mutation — a reader of `tasks.service.js` can see exactly when and what is audited without inspecting the model file.

**Option 3 — MongoDB Atlas Change Streams / Atlas Triggers.** Atlas Triggers fire server-side on document changes — the closest true equivalent to a PostgreSQL trigger. They are entirely outside the application process, so they cannot be forgotten and cannot be bypassed by any Mongoose-level bypass.

### What was chosen and why

**Option 2 — explicit `recordChange()` calls in each mutating service** was chosen. The decision is documented in Feature 08 and in Analysis Blueprint Phase 6.

The key reason `post('save')` hooks (Option 1) were not used: the audit write for status transitions and bid creation must be **atomic with the primary write** — inside the same MongoDB session and transaction, so that if the transaction aborts, the audit entry also does not exist. A `post('save')` hook fires outside the caller's session context by default; wiring it to receive and use the active session would have required passing the session through the model layer in a way that would have coupled the model to the service pattern in a brittle and non-obvious way. The explicit call pattern keeps sessions explicit and the transaction boundary clear.

Atlas Change Streams (Option 3) were considered and explicitly rejected for this project's scope: they require Atlas-hosted MongoDB specifically (not available in local Docker dev), add infrastructure surface, and introduce eventual-consistency latency between the primary write and the audit entry — the opposite of what the atomicity requirement demands.

### Non-transactional vs. transactional audit writes

Not all audit writes are wrapped in a transaction, and this is deliberate:

- **Task creation (`POST /api/tasks`)**: a single-document insert is already atomic on its own. The audit write happens after the task is persisted but outside a transaction. If the audit write fails for an infrastructure reason, the task creation still succeeds and the client receives a normal 200. An audit gap is a lesser problem than losing a successfully-created task write due to an unrelated audit failure. This design was documented and tested in Feature 08's isolation test.

- **Status transition (`PATCH /api/tasks/:id/status`) and bid creation (`POST /api/tasks/:id/bids`)**: both are wrapped in MongoDB transactions that include the audit write. Either both the primary write and the audit entry commit, or neither does. This was required by Architecture Blueprint Phase 7 and retroactively applied to Features 06 and 07 via Feature 08's addendum. The atomicity was tested with forced mid-transaction errors: in both cases the primary document rolled back, the audit entry did not appear, and the client received the appropriate error response.

---

## Architecture Rationale (Condensed)

### Layering

Every backend module follows the same three-layer structure with enforced separation: Controllers parse HTTP requests and call one service method; they contain no business logic and no Mongoose calls. Services contain all business rules, validation logic, and transaction orchestration; they call repositories and utilities but nothing HTTP-specific. Repositories contain only Mongoose model calls and accept an optional `session` parameter for transaction composition.

This separation keeps the assignment engine's complex transaction logic entirely in `assignment.service.js`, makes it independently readable and testable, and keeps the controllers thin enough that adding a new endpoint is a two-line change.

### Schema design and guard hooks

The four application-layer constraints (self-bid, bidding-open, forward-only-status, capacity) are implemented as Mongoose `pre('save')` hooks on the Bid and Task models. Each hook is also duplicated as a `pre('findOneAndUpdate')` hook on the same model, so the guard fires regardless of whether the write goes through `doc.save()` or a query-style update. This duplication was added during Feature 02 after recognising that query-style updates bypass `pre('save')` entirely.

The status-transition guard uses an `isGuardViolation` discriminator property on the error object (added in Feature 11) so the service layer can distinguish a guard-hook rejection from any other save error and translate it to the correct 409 domain error, regardless of the error message text.

### Transaction strategy

Three write paths are transactional (Architecture Blueprint Phase 7):

1. **`POST /api/tasks/:id/assign`** — the assignment engine's entire operation (workload increment, task status update, bid status updates, two audit entries) is one transaction with `readConcern: 'snapshot'` and `writeConcern: { w: 'majority' }`, plus the version-conditioned update and retry loop described in Part A.
2. **`PATCH /api/tasks/:id/status`** — the status update and its audit entry are one transaction.
3. **`POST /api/tasks/:id/bids`** — the bid creation and its audit entry are one transaction.

Task creation is explicitly not transactional — a single-document insert is already atomic.

### Error handling

Domain errors are typed classes (`NotFoundError`, `ConflictError`, `ForbiddenError`, `UnprocessableError`, `ValidationError`) with `statusCode` and `code` properties. The central error handler in `app.js` reads these properties and builds the standard envelope `{ error: { code, message, details? } }`. MongoDB-specific errors (Mongoose `ValidationError`, duplicate-key code 11000, `TransientTransactionError`) are translated to domain errors at the service/repository boundary — they never surface as raw MongoDB error objects to the client. This was verified across all error paths in Feature 11's 12-point consistency test and re-confirmed in Feature 17 §8.

---

## Stack-Deviation Note

The original assignment requires PostgreSQL with raw SQL migrations and explicitly forbids any ORM. This project uses MongoDB + Mongoose + the MERN stack per the project owner's explicit instruction.

As a decisions record, not just a pitch: this deviation deserves the same scrutiny any architectural decision gets.

**What is genuinely equivalent:**
- Multi-document ACID transactions (MongoDB 4.0+, replica-set required) replace PostgreSQL's transaction model for the three write paths that need atomicity.
- The compound unique index `{ task: 1, user: 1 }` on `bids` is a true engine-level constraint, directly analogous to a SQL `UNIQUE` constraint.
- Aggregation pipelines replace SQL `GROUP BY`/`JOIN` for the dashboard metrics — comparable expressive power, different syntax.
- Mongoose schema validators + guard hooks replace SQL `CHECK` constraints and triggers for four of the five constraints — functionally equivalent in practice, but not engine-enforced (see the constraint-honesty table in the README).

**What is genuinely weaker:**
- Four of five constraints are Mongoose application-layer hooks, not engine-level. A raw MongoDB driver write bypasses them. The original PostgreSQL version's `CHECK` constraints and triggers are enforced by the database engine regardless of what the application does.
- Without TypeScript, the shared capacity-calculation logic between client and server has no compile-time drift protection.

**The reinterpretation risk:**
Architecture Blueprint Phase 4, Assumption #12, classifies treating Mongoose as acceptable under the original brief's ORM ban as `RISKY/NEEDS CLARIFICATION`. The ban existed to force visible SQL competence; that purpose does not map directly onto MongoDB. This is a genuine reinterpretation of an explicit rule, acknowledged as such. A reviewer following the original rubric as written may still assess this submission as non-compliant with the stated stack requirements, regardless of the quality of the implementation.
