# Feature 09 — Assignment Engine

**Status:** NOT STARTED
**Depends on:** Feature 02 (Database Schema — `capacityVersion` field), Feature 05 (Users Module — `capacity.js`), Feature 07 (Bids Module), Feature 08 (Audit Log Module, including its transactional addendum) must all be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint **Phase 7 (Transaction Architecture) — read this in full before writing any code, it is the most detailed section in either blueprint document and this feature must match it exactly.** Also Phase 1 (#11), Phase 8, Phase 14 (transaction-specific error handling).

---

## ⚠️ Read This First

This is the single most important feature in the entire build. It maps directly onto the assignment's #2-ranked grading criterion ("Concurrency Handling — does your code actually prevent race conditions or does it just look like it does"). A transaction alone, without a version-conditioned conditional update, does **not** close the race condition this feature exists to solve — this has been stated explicitly in the Architecture Blueprint because it is the single most likely place a MERN implementation fails this exact test. Do not simplify this design. If anything in this MD seems more complex than necessary, that complexity is load-bearing — ask via `BLOCKED` rather than simplifying silently.

## Goal

Implement `POST /api/tasks/:id/assign`: given a task in `bidding_closed` status, find its lowest-hours bidder, atomically check whether they still have capacity (which may have changed since they bid — Part B), assign the task to them if so, or fall through to the next-lowest bidder if not, repeating until a valid bidder is found or none remain. The entire operation must be correct even when two separate calls to this endpoint (for two different tasks) are racing for the same user's remaining capacity (Part A).

## Scope (this feature ONLY)

- `backend/src/modules/assignment/assignment.controller.js`, `assignment.service.js`, `assignment.repository.js`.
- Mounting `POST /api/tasks/:id/assign` in `app.js`, following the established Router pattern.
- Reuses (does not reimplement): `capacity.js`'s `hasCapacityFor`/`getRemainingCapacity` (Feature 05), `audit.service.js`'s session-aware `recordChange` (Feature 08), `bids.repository.js`'s sorted bid retrieval (Feature 07), `task.setStatus()` (Feature 02).

## Explicitly OUT of scope for this feature
- No changes to the bid-time capacity check (Feature 07) — that stays soft/advisory, unchanged.
- No changes to the status-transition endpoint (Feature 06) for statuses other than what this feature itself needs to apply (`bidding_closed → assigned`) — this feature applies that specific transition as part of its own transaction, it does not call Feature 06's endpoint/service.
- No frontend work.

---

## The Algorithm (must match Architecture Blueprint Phase 7 exactly)

Implement this as a single service function, e.g. `assignTask(taskId, actorUserId)`, called by the controller:

1. **Retry loop, bounded to 3 attempts.** Each attempt:
   a. Start a new session (`mongoose.startSession()`), start a transaction with `readConcern: 'snapshot'`, `writeConcern: { w: 'majority' }`.
   b. Fetch the task within the session. If not found: abort, throw `NotFoundError`. If `task.status !== 'bidding_closed'`: abort, throw `ConflictError`.
   c. Fetch all bids for the task within the session, sorted ascending by `hoursOffered` (reuse `bids.repository.js`'s sorted-fetch function, passing the session through).
   d. If there are zero bids: abort, throw `UnprocessableError('No bids exist for this task')`.
   e. Iterate the sorted bids in order. For each candidate bid:
      - Fetch the candidate's `User` document within the session, capturing `currentWorkloadHours`, `maxCapacityHours`, and `capacityVersion` at this exact read.
      - Check `hasCapacityFor(candidateUser, bid.hoursOffered)` (from `capacity.js` — reuse, don't reimplement this comparison).
      - **If capacity is sufficient:** attempt the conditional update: `User.findOneAndUpdate({ _id: candidateUser._id, capacityVersion: candidateUser.capacityVersion }, { $inc: { currentWorkloadHours: bid.hoursOffered, capacityVersion: 1 } }, { session, new: true })`.
        - If this returns a document (matched and updated): **this candidate wins.** Continue to step (f).
        - If this returns `null` (version had already moved — another concurrent transaction beat this one to updating this exact user): **abort this entire transaction** and trigger a fresh retry attempt from step (a) — do not just move to the next bid candidate within the same attempt, since the underlying bid/task/user data may now be stale in ways beyond just this one user's capacity. Count this as one used retry attempt.
      - **If capacity is insufficient** (from the plain read in the check above, no version conflict involved): move to the next candidate bid in the loop, continuing within the *same* transaction attempt (this is not a conflict, just an ordinary "this bidder doesn't fit" outcome — no need to retry the whole attempt for this).
      - If no candidate in the entire sorted list has sufficient capacity: abort the transaction, throw `UnprocessableError('No eligible bidder has sufficient capacity')`.
   f. **Winning candidate found — apply the rest of the assignment within the same transaction:**
      - Fetch the task again if needed (should already be in scope from step b) and apply: `task.setStatus('assigned')`, set `task.assignedUser = winningBid.user`, `task.assignedBid = winningBid._id`, `await task.save({ session })`.
      - Update the winning bid: `winningBid.status = 'assigned'`, `await winningBid.save({ session })`.
      - Update all other bids on this task to `status: 'not_selected'` (a `Bid.updateMany({ task: taskId, _id: { $ne: winningBid._id } }, { status: 'not_selected' }, { session })` is acceptable here specifically — this is a status-only field with no guard-hook protection tied to it beyond what's already been validated by this point, unlike the task/bid guards discussed in earlier features which protect self-bid/bidding-open/forward-only-status specifically).
      - Call `recordChange(...)` (Feature 08's session-aware audit service) for the task's status change (`bidding_closed → assigned`) and for the bid's status change (`pending → assigned`), passing the session through.
      - `await session.commitTransaction()`. Return the result (assigned user, winning bid).
   g. On any unexpected error at any step: `await session.abortTransaction()`, then either retry (if it was specifically a version-conflict from step e) or rethrow (for genuine errors — task not found, wrong status, no eligible bidder, or true infrastructure errors).
   h. Always `session.endSession()` in a `finally` for each attempt.
2. If all 3 retry attempts are exhausted due to repeated version conflicts (an extremely unlikely but possible outcome under heavy contention): return a 503 asking the client to retry the whole `/assign` call again later — do not silently return an incorrect result, and do not let this be confused with the "no eligible bidder" 422 case, which is a different, business-level outcome.

### Error Handling Specifics (per Architecture Blueprint Phase 14)

- Catch MongoDB's `TransientTransactionError` and `UnknownTransactionCommitResult` labeled errors specifically (check `error.hasErrorLabel(...)` if using the native driver's error-labeling, or the equivalent Mongoose-surfaced property) — these represent expected, recoverable contention, not genuine faults. Route them into the same retry logic as an explicit version-conflict, not into a generic 500.
- A genuine 500 should only occur for truly unexpected errors (e.g., a real DB connectivity loss) — do not let a version-conflict or transient-transaction error surface as a 500 to the client under normal operation within the retry budget.

---

## Endpoint Specification

**`POST /api/tasks/:id/assign`**
- Middleware: `currentUser` (the triggering actor is recorded in the audit log, per Feature 08's pattern — Architecture Blueprint notes this even though the *effect* isn't "by" that user in the same sense a bid is), `validate(taskIdParamSchema, 'params')`.
- Response (200 success): `{ assignedUserId, assignedBidId, task }`.
- Errors: 404 (task not found), 409 (task not in `bidding_closed`), 422 (no bids exist, or no eligible bidder has capacity), 503 (retry budget exhausted under contention — rare).

---

## Acceptance Criteria

- [ ] Happy path: a `bidding_closed` seeded task with a lowest bidder who has capacity is assigned correctly — task status becomes `assigned`, `assignedUser`/`assignedBid` set, winning bid becomes `assigned`, other bids on that task become `not_selected`, two audit entries created (task status change, bid status change).
- [ ] Fallback path: manually construct or use seeded data where the lowest bidder does NOT have capacity (e.g., temporarily reduce a user's `maxCapacityHours` via direct DB edit for this test) and confirm the engine correctly falls through to the next-lowest bidder.
- [ ] No-eligible-bidder path: a task where every bidder lacks capacity returns 422, and confirm via DB query that no assignment side-effects occurred (task still `bidding_closed`, no bid marked `assigned`, no audit entries for this attempt).
- [ ] Wrong-status path: attempting `/assign` on a task not in `bidding_closed` (e.g., still `open`) returns 409.
- [ ] **The Part-A concurrency test (the most important test in this entire project):** using the seeded near-capacity users (Bilal 13/15h, Usman 8/10h), construct or confirm two `bidding_closed` tasks whose lowest bidder is the same near-capacity user, where accepting both bids would exceed that user's capacity but accepting either alone would not. Fire both `/assign` calls at true concurrency (e.g., `Promise.all` from a script, not sequential awaits) and confirm: exactly one task is assigned to that user; the other task either falls through to its next-lowest bidder or returns 422 if none remain; the user's final `currentWorkloadHours` reflects only the one successful assignment, never both.
- [ ] Repeat the Part-A test multiple times (run it 5–10 times in a loop) to build confidence this is deterministic and not passing by lucky timing — race conditions can pass by accident on a single run.
- [ ] Version-conflict retry actually exercised at least once during the Part-A test (confirm via a log statement or debugger that the retry path was hit, not just that the final outcome happened to be correct) — silence here would suggest the test conditions didn't actually create real concurrency (e.g., if both calls didn't truly overlap in time).

## Self-Test Checklist (do this before reporting ready)

1. Run the happy path, fallback path, no-eligible-bidder path, and wrong-status path individually first, confirming each in isolation before attempting the concurrency test.
2. Build a small disposable script (not a permanent file) that fires two `/assign` calls via `Promise.all` against two prepared `bidding_closed` tasks sharing a capacity-constrained lowest bidder, and run it the 5–10 times required by the acceptance criteria above.
3. After each concurrency test run, directly query the database (not just trust the HTTP responses) to confirm the user's `currentWorkloadHours` and `capacityVersion` are internally consistent (i.e., `capacityVersion` incremented exactly once per successful assignment involving that user, not zero times or twice).
4. Confirm audit entries exist for every successful assignment and are absent for every failed/rolled-back attempt.
5. Confirm ESLint clean, no `.ts` files, no raw `.collection.` calls.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, you must explicitly state:
- The exact number of retry attempts observed during your concurrency test runs (e.g., "in 10 runs, the retry path was hit N times") — a report that never observed a single retry across many runs is a signal the test wasn't creating genuine concurrency, and should be investigated rather than reported as a pass.
- Confirmation that `hasCapacityFor`/`getRemainingCapacity` were reused from Feature 05 by name, not reimplemented.
- Confirmation that `recordChange` from Feature 08 was reused by name, with a session, for both the task and bid status changes made by this feature.
- Which specific seeded (or manually constructed) tasks/users you used for the Part-A test, so this can be reproduced later in Feature 17's full integration pass.
