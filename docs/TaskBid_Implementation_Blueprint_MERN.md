# TaskBid — Implementation Blueprint (MERN Stack Version)
### Buggcy Full-Stack Take-Home Assignment (Real-Time Collaborative Task Auction System)
Adapted to MongoDB, Express, React, Node.js — plain JavaScript (no TypeScript). No code included.

> ⚠️ **Important flag before anything else:** the original assignment PDF explicitly mandates **PostgreSQL with raw SQL migrations** and explicitly forbids any ORM, specifically because criteria #1 (Schema Design) and #3 (SQL Proficiency) are graded on relational schema thinking and SQL competence. Switching to MongoDB is a **fundamental deviation from the stated requirements**, not a stack-neutral choice — a reviewer following the rubric as written would likely mark down or reject a MongoDB submission regardless of how well it's built. This document proceeds exactly as you asked, with no content dropped, but you should confirm this is intentional (e.g., a personal-stack practice run, or the recruiter has separately approved MERN) before submitting it as the actual assessment. Every phase below is preserved 1:1 from the original blueprint, with only the stack-specific mechanics swapped.

---

## PHASE 1 — Executive Summary

**Project overview:** TaskBid is an internal marketplace tool where a small team posts tasks and members bid the number of hours they'd need to complete each task. The lowest valid bidder (by hours, respecting weekly capacity) is auto-assigned the task.

**Business goal:** Distribute work fairly and efficiently across a team by using a low-friction bidding mechanism, while making sure no one is over-allocated beyond their stated weekly capacity.

**Problem being solved:** Manual task assignment is slow and doesn't account for real-time changes in individual workload. TaskBid automates "who should do this" by combining self-reported estimates (bids) with live capacity tracking, and it must do so correctly even when multiple assignments race for the same person's remaining hours.

**Target users:** A small internal team (data suggests dozens, not thousands, of users) — task creators/managers and task-doers who also bid. No indication of external customers or multi-tenant use.

**Main workflow:** Create task (draft) → open for bidding → team members bid hours → bidding closes → system (or a manager) triggers `/assign`, which finds the lowest-hours bidder who still has capacity → task moves through in_progress → review → done, with every transition audited.

**Expected deliverables (MERN-adapted):**
- GitHub repo: MongoDB schema definitions (Mongoose models, since raw MongoDB has no "migration" concept in the SQL sense — see Phase 2/9 for how this is handled), JavaScript backend (Node.js + Express), JavaScript React frontend, seed script, README, DECISIONS.md (or README section) covering Parts A–D.
- Live deployed URL (frontend + backend + DB), seeded, working real-time updates in production.
- 10-minute Loom video covering schema decisions, race-condition demo, a retrospective item, and a proud moment.

**Success criteria (as graded, reinterpreted for MongoDB):** correctness/thoughtfulness of document schema design and validation rules, actual (not superficial) concurrency safety using MongoDB transactions, non-trivial aggregation-pipeline competence (the MERN analogue of "SQL proficiency"), real error handling, quality of written trade-off reasoning, code navigability, and a genuinely working, seeded, real-time deployment.

---

## PHASE 2 — Requirement Extraction

### Functional Requirements

**Data / Schema (MongoDB collections via Mongoose)**
- `users` collection: name, email, hourlyRate, currentWorkload (derived or stored), maxCapacity/week.
- `tasks` collection: title, description, estimatedComplexity (1–5), status, createdBy, deadline.
- `bids` collection: hoursOffered, user (ref), task (ref), createdAt, status.
- `auditlogs` collection: actor, entity/field changed, oldValue, newValue, timestamp — for both task and bid state changes.

**Backend API** (unchanged surface — only the data layer underneath changes)
- `POST /api/tasks` — create task (status = draft).
- `PATCH /api/tasks/:id/status` — advance status, validating the fixed lifecycle order.
- `POST /api/tasks/:id/bids` — place a bid on an open task.
- `GET /api/tasks/:id/bids` — list bids sorted ascending by hours.
- `POST /api/tasks/:id/assign` — atomic auto-assignment to lowest valid bidder, with fallback to next bidder.
- `GET /api/users/:id/workload` — current workload + remaining capacity.
- `GET /api/dashboard/stats` — aggregated stats, efficiently queried via MongoDB aggregation pipelines.

**Database-level constraints, reinterpreted for MongoDB (must be enforced as close to the data layer as MongoDB allows, not just in route-handler code)**
- No self-bidding — MongoDB has no cross-document CHECK constraint; enforced via a Mongoose pre-save hook on `Bid` that looks up the parent task's `createdBy` and rejects a match. This is the closest MERN equivalent to a DB-level trigger.
- No bid that would push accepted workload past max capacity — flagged as ambiguous in Phase 4/5, same as the original (bid-time vs. assignment-time tension is stack-independent).
- No bids after `bidding_closed` — enforced in the same pre-save hook, checking the referenced task's current status.
- No backward status transitions — enforced via a Mongoose pre-save/pre-update hook on `Task` comparing old vs. new status against a fixed sequence.
- No duplicate bid (same user, same task) — enforced via a **MongoDB compound unique index** on `bids` over `{ task: 1, user: 1 }`. This is the one constraint MongoDB enforces natively and non-bypassably at the database layer, directly analogous to a SQL `UNIQUE` constraint.

**Frontend** (unchanged — React, just JavaScript instead of TSX)
- Task Board (kanban by status): title, complexity, deadline, bid count, lowest bid per card; click → detail view.
- Task Detail: full task info, all bids, bid form (only if open), client + server capacity validation, handling of capacity-changed-between-load-and-submit.
- Dashboard: renders stats endpoint output, at least one chart.
- Real-time bid updates on Task Detail view (Socket.IO recommended — see Phase 12-equivalent reasoning carried from the architecture doc).
- User-switcher dropdown simulating auth (no real auth required).

**Assignment logic (`/assign`)**
- Find lowest bid → check bidder capacity at assignment time (not bid time) → assign + update workload if capacity allows → else skip to next lowest → if none valid, return explicit error → whole operation atomic, race-safe across concurrent `/assign` calls competing for the same user, implemented via a **MongoDB multi-document ACID transaction** (requires a replica-set-enabled MongoDB instance — see Phase 4 assumption on this).

**Dashboard stats (via MongoDB aggregation pipeline, not SQL)**
- Tasks grouped by status — `$group` by `status`.
- Average bid amount per complexity level — `$lookup` bids→tasks (or the reverse), `$group` by `complexity`, `$avg` on `hoursOffered`.
- Top 3 users by completed task count — `$match status: 'done'`, `$group` by `assignedUser`, `$sort`, `$limit: 3`.
- Tasks that received zero bids and are past their deadline — `$lookup` tasks→bids, `$match` on empty bids array + `deadline < now`.

### Non-Functional Requirements
- **Concurrency correctness** — still the #2 conceptual priority; two simultaneous `/assign` calls must not both succeed if they'd jointly over-allocate one user. In MongoDB this is achieved via multi-document transactions + optimistic concurrency (version key), not row-level `FOR UPDATE` locking (MongoDB has no exact equivalent) — detailed reasoning belongs in the architecture doc, but the requirement itself is unchanged.
- **"SQL proficiency" → "Aggregation-pipeline / data-modeling proficiency"** — since raw SQL is explicitly what the original assignment wants to see and that's no longer applicable in MongoDB, the honest reframe is: demonstrate non-trivial aggregation pipelines, thoughtful embedding-vs-referencing decisions, and correct index usage. **This is the single biggest scoring risk of the stack switch** — flag prominently in submission notes if this blueprint is used for the actual graded assignment.
- **Performance** — dashboard stats must be efficient ("single query or minimal queries") — translates to "as few aggregation pipeline calls / round trips as reasonably possible," same spirit as the original.
- **Error handling** — errors must be informative to the caller, not generic 500s. Unchanged.
- **Security** — standard hygiene: Mongoose's parameterized query construction inherently avoids the classic SQL-injection vector, but MongoDB has its own analogous risk (NoSQL injection via unsanitized operator objects in query input, e.g., `{ "$gt": "" }` passed as a field value) — must be explicitly guarded against (see Phase 15).
- **Deployment** — must be live, on a free tier, functional at review time, stable for ≥2 weeks. Unchanged; free-tier MongoDB via Atlas replaces Neon/Supabase/Render-Postgres.
- **Maintainability / code organization** — unchanged expectation.
- **Documentation** — README with setup (`docker-compose up` or equivalent), **schema definition files** (Mongoose models) instead of numbered SQL migration files (see Phase 3 hidden-requirements note on why "migrations" don't map 1:1 to Mongo), DECISIONS write-up for Parts A–D.
- **No over-engineering** — unchanged: no Kubernetes, no microservices, no CI/CD pipeline.
- **Language constraint (updated per your instruction):** plain JavaScript throughout, no TypeScript, no full relational ORM (Mongoose is the standard MongoDB ODM and is the expected/idiomatic choice here — unlike the original assignment's ORM ban, which was specifically about hiding SQL, Mongoose doesn't have an equivalent "hides the interesting part" objection since MongoDB has no SQL to hide).
- **Time-box** — 48–72 hours from receipt. Unchanged.

---

## PHASE 3 — Hidden (Implicit) Requirements

- **Loading states** — unchanged; Task Board, Task Detail, and Dashboard all fetch async data.
- **Error states in UI** — unchanged.
- **Empty states** — unchanged.
- **Optimistic UI vs. real-time reconciliation** — unchanged.
- **Idempotency / duplicate-submit protection** — unchanged in spirit; in MongoDB this leans more heavily on the unique index (`{task,user}` on bids) since there's no transaction-wide row lock backstopping every table the way Postgres's constraint system would.
- **Numbered, ordered "migrations" → versioned schema/model files** — MongoDB is schema-flexible by default, so there's no built-in migration runner. **Recommended approach:** use a lightweight migration tool anyway (e.g., `migrate-mongo`) purely for documenting and replaying schema/index changes (like adding the unique index or a new field) in an ordered, numbered way — this preserves the spirit of "numbered and ordered migration files" even though MongoDB doesn't strictly require them to function.
- **Seed script covering every feature path** — unchanged requirement, implemented via a Node.js script using Mongoose models directly (`node seed.js`) instead of a `seed.sql` file.
- **Environment variables / config** — `MONGODB_URI` replaces `DATABASE_URL`; otherwise unchanged (ports, Socket.IO URL).
- **CORS configuration** — unchanged.
- **Real-time reconnect handling** — unchanged.
- **Transaction "isolation level" choice → MongoDB transaction + read/write concern choice** — MongoDB transactions default to snapshot isolation (comparable in spirit to `SNAPSHOT`/`REPEATABLE READ`); the deliberate choice to document is **read concern `snapshot` + write concern `majority`** for the assignment transaction, plus whether optimistic-concurrency retries are needed (see Phase 7-equivalent reasoning in the architecture doc). This must be a documented, deliberate choice, not an unexamined default — same spirit as the original SQL requirement.
- **Retry/backoff on failed capacity checks** — unchanged; additionally, MongoDB transactions can throw `TransientTransactionError` under contention and conventionally require an app-level retry loop — this is itself a hidden requirement introduced by the stack switch and should be explicitly implemented and documented.
- **Consistent HTTP status code + error shape convention** — unchanged.
- **README as a first-class deliverable** — unchanged.
- **Git history quality** — unchanged.
- **Docker Compose (or equivalent) for local dev** — unchanged, except the Compose file now spins up a **MongoDB replica set** (a single-node replica set is required even for local dev, because multi-document transactions do not work on a standalone, non-replica-set MongoDB instance) rather than a single Postgres container — this is a materially bigger local-setup lift than the original Postgres version and should be flagged as such.

---

## PHASE 4 — Assumptions

| # | Assumption | Classification |
|---|---|---|
| 1 | "Capacity" is measured in hours/week and is a hard cap, not a soft target. | SAFE (stated directly) |
| 2 | A bid's "hours offered" becomes the task's committed workload hours upon assignment. | SAFE |
| 3 | Bid-time capacity check (advisory) vs. assignment-time capacity check (authoritative) are two separate checks. | NEEDS CLARIFICATION — same tension as the original spec; stack-independent, carried over unchanged. |
| 4 | Only one user can be assigned to a task. | SAFE |
| 5 | "Workload" = sum of hours from tasks currently assigned/in_progress. | RISKY |
| 6 | No real authentication required; user-switcher simulates identity. | SAFE |
| 7 | The audit log is append-only. | SAFE |
| 8 | `bidding_closed` is a manual transition, not deadline-triggered. | RISKY |
| 9 | Complexity (1–5) is informational only. | RISKY |
| 10 | Free-tier deployment constraints are acceptable. | SAFE |
| 11 | "Top 3 users by tasks completed" counts status = done tasks. | SAFE |
| 12 | **NEW, MERN-specific:** Mongoose (an ODM) is an acceptable and expected data-access layer for MongoDB, unlike the original spec's ban on relational ORMs — because the original ban's purpose (forcing visible SQL competence) doesn't have a MongoDB equivalent to protect. | RISKY/NEEDS CLARIFICATION — this is exactly the kind of assumption that should be surfaced to whoever is evaluating this MERN submission, since it reinterprets an explicit rule from the original document rather than just translating mechanics. |
| 13 | **NEW, MERN-specific:** a single-node MongoDB replica set (rather than a full multi-node cluster) is acceptable for both local dev and the free-tier production deployment, purely to unlock multi-document transaction support. | SAFE — MongoDB Atlas's free tier (M0) provisions a replica set by default, so this is generally satisfied automatically in production; local dev requires explicit replica-set initialization in Docker Compose. |

---

## PHASE 5 — Clarification Questions for the Recruiter

**Business** (unchanged from original — 1–3)
1. Is capacity a hard weekly cap that resets weekly, or a rolling/project-total figure?
2. Should `bidding_closed` ever be triggered automatically by the task's deadline, or is it always manual?
3. Does task `complexity` (1–5) have any prescribed relationship to expected hours?

**Technical / Concurrency**
4. Bid-time vs. assignment-time capacity semantics — same open question as the original.
5. Should a skipped-over-capacity bid be marked with a distinct status for auditability?
6. **NEW:** Given the original assignment explicitly requires PostgreSQL, raw SQL, and forbids ORMs specifically to evaluate SQL/schema skills — is a MongoDB/MERN submission acceptable in place of the stated stack, or should this blueprint be treated as a personal practice exercise rather than the actual deliverable?

**Design**
7. Component library preference (unchanged).
8. Scope of the outbid-toast bonus notification (unchanged).

**Deployment**
9. Cold-start tolerance (unchanged, applies equally to Render hosting a Node/Express + MongoDB stack).
10. Minimum uptime SLA (unchanged).

**Authentication / Users**
11. Should the switcher persist selection across reloads? (unchanged)

**Database / API**
12. Status code convention on blocked transitions (unchanged).
13. Dashboard response-time budget (unchanged).
14. **NEW:** Is a single-node MongoDB replica set (needed for transactions) an acceptable local-dev requirement, or would the reviewer prefer the submission avoid multi-document transactions entirely (e.g., via optimistic concurrency with version numbers only, no `session.startTransaction()`)?

---

## PHASE 6 — Feature Breakdown

**Feature: Task Lifecycle Management**
- Define status enum (Mongoose `enum` validator on the `status` field) + allowed-transition table.
- Enforcement via a Mongoose pre-save/pre-update hook preventing backward or skipped-forward moves (application-level, since MongoDB has no trigger/CHECK equivalent spanning old-vs-new value comparison — this is a **stack-driven change**: in Postgres this was a DB-level trigger; in MongoDB it is necessarily hook-level, i.e., "application code," which is worth noting as a real trade-off introduced by the stack switch, not just a translation).
- `PATCH /api/tasks/:id/status`: validate transition → apply → write audit document.
- UI: unchanged.

**Feature: Bidding**
- `POST /api/tasks/:id/bids`: validate task is open, validate not self-bid, validate no duplicate bid (unique index backstop), validate (soft) capacity, insert, write audit document.
- `GET /api/tasks/:id/bids`: sorted ascending by hours — via `.find().sort({ hoursOffered: 1 })`, backed by a compound index `{ task: 1, hoursOffered: 1 }`.
- UI: unchanged.

**Feature: Assignment Engine**
- `POST /api/tasks/:id/assign`: wrapped in a Mongoose/MongoDB session transaction (`session.startTransaction()`), iterate bids ascending, re-read candidate user document *within the transaction* to get a consistent view, capacity re-check per candidate, update task + user workload atomically, write audit document(s), explicit "no valid bidder" error path, commit or abort.
- Concurrency handling detail (MongoDB-specific): since MongoDB transactions don't offer row-level `SELECT ... FOR UPDATE` semantics identical to Postgres, the recommended approach is **optimistic concurrency via a `__v`/version field or a manual `capacityVersion` counter** on the `users` document — the update to a candidate's workload is conditioned on the version matching what was read (`findOneAndUpdate({ _id, capacityVersion: readVersion }, { $inc: {...}, $inc: { capacityVersion: 1 } })`), and if the conditional update matches zero documents, the transaction aborts/retries, treating that as "someone else changed this user's workload first." This is the MERN-equivalent mechanism to Postgres's `FOR UPDATE` row lock — full mechanics belong in the architecture document's transaction-strategy phase.
- UI: unchanged.

**Feature: Workload & Capacity**
- `GET /api/users/:id/workload`: unchanged in shape.
- Shared calculation logic: a single JS utility module (`utils/capacity.js`) imported by the bid route, the assignment service, and this endpoint — same "single source of truth" principle as the original, just JavaScript instead of TypeScript.

**Feature: Dashboard**
- `GET /api/dashboard/stats`: implemented as one or more MongoDB **aggregation pipelines** (the direct analogue of SQL `GROUP BY`/`JOIN`), see Phase 2 for the specific pipeline shape per metric.

**Feature: Real-Time Updates** — unchanged (Socket.IO recommended, independent of DB choice).

**Feature: Audit Log**
- Choice reframed: "DB trigger vs. application-level middleware" from the original becomes, in MongoDB terms, "**Mongoose document middleware (pre/post hooks) vs. a manually-called service function**." MongoDB does have a trigger-like feature (**Atlas Change Streams / Atlas Triggers**) which is the closest true equivalent to a Postgres trigger, but it requires Atlas-hosted MongoDB and adds infra surface — recommend documenting Change Streams as the "trigger equivalent" alternative and explaining why a simpler, explicit service-call approach (or Mongoose post-save hooks) was chosen instead, mirroring the original Part D reasoning.

**Feature: User-Switcher** — unchanged.

---

## PHASE 7 — User Flows

Unchanged from the original — every flow (happy path, self-bid rejection, stale bid, duplicate bid, no-valid-bidder, capacity race) is stack-independent business logic. The only technical footnote: "DB constraint fires" in the original should now be read as "Mongoose pre-save hook rejects, or the unique index throws a duplicate-key error (code 11000) for the duplicate-bid case specifically."

---

## PHASE 8 — Edge Cases

Unchanged in substance from the original (validation, business logic, API, UI, database, concurrency, network, authorization edge cases all still apply). Two MongoDB-specific additions:

- **Duplicate-key error handling:** a duplicate bid insert throws a MongoDB error with `code: 11000`, not a generic exception — the error-handling middleware must specifically detect this code and translate it into the same clear "You've already placed a bid on this task" message the original blueprint calls for.
- **Transient transaction errors:** concurrent `/assign` calls under MongoDB's transaction model can throw `TransientTransactionError` or `UnknownTransactionCommitResult` — these must be explicitly caught and retried (with a bounded retry count) rather than surfaced as a raw 500, since they're an expected, recoverable outcome of the concurrency model, not a genuine failure.

---

## PHASE 9 — Data Model Analysis (No Code, Mongo-Native Framing)

**users**
- Fields: name, email (unique index), hourlyRate, maxCapacityHours, currentWorkloadHours (denormalized, maintained via the assignment transaction — same reasoning as the SQL version: without a maintained field, there's nothing meaningful to apply optimistic-concurrency versioning to), capacityVersion (new, MERN-specific — see Phase 6).
- Referenced (not embedded) by tasks and bids, since users are a shared, independently-queried entity — embedding would duplicate user data across every task/bid document and complicate updates.

**tasks**
- Fields: title, description, complexity (1–5, enum/min-max validator), status (enum), createdBy (ref → users), assignedUser (ref → users, nullable), assignedBid (ref → bids, nullable), deadline.
- **Embedding vs. referencing bids:** recommend **referencing**, not embedding bids as a sub-array on the task document — bids are written frequently and independently (real-time creation), and an unbounded embedded array risks the 16MB document size ceiling and write-contention on the parent task document under concurrent bid submissions. This is the single most important MongoDB-specific data-modeling decision in this project and should be explicitly justified in the README, mirroring how the original justified its relational FK design.

**bids**
- Fields: task (ref, indexed), user (ref, indexed), hoursOffered, status, createdAt.
- **Compound unique index** on `{ task: 1, user: 1 }` — the direct MongoDB equivalent of the SQL `UNIQUE(task_id, user_id)` constraint, and the one constraint from the original list that maps cleanly and non-bypassably to native MongoDB functionality.
- Compound index `{ task: 1, hoursOffered: 1 }` supporting the sorted-bid-list query and the assignment engine's ordered scan — same rationale as the SQL version.

**auditlogs**
- Fields: entityType ('task'|'bid'), entityId, actorUserId, fieldChanged, oldValue, newValue, changedAt.
- No true polymorphic reference type in MongoDB the way a FK constraint would demand — `entityId` is simply an ObjectId with no `ref` enforcement across two possible collections, same documented trade-off as the original SQL version's "not a formal FK" note.

**No soft-delete requirement** — same as original; no DELETE endpoints exist in the spec.

---

## PHASE 10 — API Planning (No Code)

Endpoint list, request/response shapes, validation rules, and status codes are **unchanged from the original** (Phase 10 of the analysis document) — none of that content is SQL-specific. The only technical footnotes:
- Every endpoint's underlying data access now goes through Mongoose models instead of a query builder.
- Error responses must specifically translate MongoDB's native error shapes (validation errors from Mongoose schema validators, duplicate-key errors, transient transaction errors) into the same consistent JSON error envelope described in the original blueprint.

---

## PHASE 11 — Frontend Planning

Unchanged from the original in every respect **except**: all component/hook files are plain `.jsx`/`.js` (no `.tsx`/`.ts`), no compile-time type-checking layer — meaning **PropTypes or JSDoc type comments are recommended as a lightweight substitute** for catching shape mismatches that TypeScript would otherwise catch at compile time, since the original blueprint's "shared types between client and server" strategy no longer applies in the same way without TypeScript's type system.

---

## PHASE 12 — Backend Planning

Unchanged in module/layer structure (controllers → services → repositories → validation → error handling → logging → config) **except**:
- "Repository" layer now wraps Mongoose model calls (`Model.find()`, `Model.findByIdAndUpdate()`, etc.) instead of Knex query-builder calls.
- Validation library: recommend **Joi** or **express-validator** for request-body/param validation in plain JavaScript (Zod is TypeScript-oriented in ergonomics, though usable in JS — Joi is the more idiomatic choice for a pure-JS Express app and is what most MERN references use).
- No migration-runner equivalent to Knex's migration CLI is strictly required, but `migrate-mongo` is recommended for the numbered/ordered schema-change trail (Phase 3).

---

## PHASE 13 — UI/UX Requirements

Unchanged from the original in full — none of these (spacing, responsiveness, forms, accessibility, loading, errors, notifications) are backend-stack-dependent.

---

## PHASE 14 — Validation Matrix

Unchanged in substance from the original table (Create Task form, Bid form, Status transition control) — every rule still applies identically. Only the "DB CHECK too" column note changes: complexity range and positive-hours-offered validation are enforced via **Mongoose schema-level validators** (`min`/`max`, `required`, custom `validate` functions) rather than SQL `CHECK` constraints — functionally equivalent in effect (both reject invalid writes before persistence), though Mongoose validators are technically application-layer (they run in the Node process, not inside the database engine itself) rather than true database-engine-level constraints, which is a nuance worth noting given the original spec's emphasis on database-level enforcement specifically.

---

## PHASE 15 — Security Review

Unchanged from the original except:
- **"SQL injection risk" → "NoSQL injection risk":** MongoDB has its own injection class — if raw user input (e.g., a JSON body) is passed directly into a Mongoose query filter without sanitization, an attacker could inject operators like `{ "$ne": null }` to bypass an intended equality check. **Mitigation:** validate/sanitize all input via the Joi/express-validator schemas before it ever reaches a Mongoose query, and consider the `express-mongo-sanitize` middleware as a defense-in-depth layer that strips `$`-prefixed keys from incoming request bodies/params/queries.
- Everything else (XSS via React's default escaping, CORS, secrets in env vars, no real auth, no CSRF relevance, no file upload) is unchanged and stack-independent.

---

## PHASE 16 — Testing Strategy

Unchanged in structure and critical scenarios from the original. One MongoDB-specific addition to the integration testing plan: verify that a duplicate-key error (code 11000) on the bids unique index is correctly caught and translated to a clean 409, and that a simulated `TransientTransactionError` during `/assign` triggers the app's retry logic rather than surfacing as an unhandled 500 — both are new failure modes introduced specifically by the MongoDB transaction model that didn't exist in the same form in the Postgres version.

---

## PHASE 17 — Development Roadmap

| Stage | Goal | Notes vs. Original |
|---|---|---|
| 1. Project setup | Repo scaffolding, JS (not TS) config, Docker Compose for a **single-node MongoDB replica set**, env config | Compose complexity increased — replica-set init script required for transactions to work at all, even locally |
| 2. Schema & models | Define Mongoose schemas for all entities + validators + indexes; optionally set up `migrate-mongo` for ordered schema-change tracking | Replaces "numbered raw SQL migrations"; lower ceremony but also less of the "SQL competence" signal the original rewards |
| 3. Seed script | Node script using the Mongoose models directly | Same goal, different mechanism |
| 4. Core backend CRUD | Same endpoints, via Mongoose | Unchanged effort |
| 5. Assignment engine | Transactional `/assign` using MongoDB sessions + optimistic-concurrency versioning | **Highest-risk stage in the MERN version** — MongoDB transactions plus manual version-conflict retry logic is arguably more intricate to get right than Postgres's `FOR UPDATE`, despite looking simpler on the surface |
| 6. Dashboard endpoint | Aggregation pipelines instead of SQL `GROUP BY`/joins | Comparable effort, different syntax/mental model |
| 7. Audit logging | Mongoose hooks or explicit service calls | Unchanged goal |
| 8–11. Frontend stages | Unchanged | Purely stack-independent |
| 12. Integration & manual test pass | Add the two new MongoDB-specific scenarios (duplicate-key handling, transient-transaction retry) to the checklist | New |
| 13. README / DECISIONS.md | Must now also justify the MongoDB-vs-Postgres deviation itself, not just internal choices | **New, important addition** — see the flag at the top of this document |
| 14. Deployment | MongoDB Atlas (free M0 tier, replica-set by default) + Render (backend) + Vercel (frontend) | Atlas replaces Neon/Supabase/Render-Postgres from the original |
| 15–16. Loom + submission | Unchanged | — |

---

## PHASE 18 — Priority Matrix

Unchanged in structure from the original (Must/Should/Nice/Optional) — substitute "the five DB-level constraints" in Must Have with: **the one native unique-index constraint (no duplicate bids) plus the four application/hook-level enforced rules (self-bid, no bid after close, no backward transition, capacity-aware assignment)** — since only one of the five maps to true database-engine-level enforcement in MongoDB, this distinction should be called out explicitly wherever "database-level constraints" is mentioned in any deliverable, since it's a materially weaker guarantee than the original Postgres version for four of the five rules.

---

## PHASE 19 — Risks

Unchanged risk categories from the original, with these MERN-specific additions:

**New technical risk — weaker constraint guarantees:** four of the five "must be DB-level" constraints from the original spec can only be enforced at the Mongoose/application-hook level in MongoDB, not the true database engine level (only the unique index is a real exception). *Mitigation:* be explicit and honest about this in the README rather than overstating hook-level enforcement as equivalent to a SQL constraint — a reviewer familiar with both stacks will notice the gap immediately if it's glossed over.

**New technical risk — transaction/replica-set setup friction:** MongoDB transactions require a replica set even for a single local instance, which is nonstandard/extra setup relative to a stock MongoDB install and relative to the original's plain Postgres container. *Mitigation:* document the replica-set initialization step clearly in the README's setup instructions, since a reviewer running `docker-compose up` and hitting a transaction error because they're on a standalone Mongo instance is a realistic and entirely avoidable failure mode.

**New business/scoring risk — stack deviation from an explicit requirement:** as flagged at the top of this document, this is the single biggest risk introduced by this conversion and should be resolved with whoever is grading the assignment before final submission, not discovered after the fact.

---

## PHASE 20 — Final Implementation Blueprint (Execution Order)

1. **Project setup** — repo structure, plain JS configs (frontend + backend), Docker Compose spinning up a **single-node MongoDB replica set**, base env files (`MONGODB_URI`, etc.).
2. **Architecture decisions locked in** — resolve Phase 4/5 ambiguities, **plus explicitly decide and document the MongoDB-vs-Postgres deviation rationale** before writing any schema.
3. **Database** — Mongoose model definitions for users/tasks/bids/auditlogs, unique + compound indexes, optional `migrate-mongo` setup for ordered schema-change tracking; seed script covering every status, every dashboard metric, and a capacity-race-ready data set.
4. **Backend core** — tasks/bids endpoints, status-transition endpoint, workload endpoint, validation middleware (Joi/express-validator), shared error-handling convention including Mongoose-specific error translation.
5. **Assignment engine** — transactional, session-based `/assign` with optimistic-concurrency retry logic; validate manually with concurrent test calls before moving on — **this is the stage to budget the most extra time for relative to the original SQL plan.**
6. **Dashboard endpoint** — aggregation-pipeline design.
7. **Audit logging** — Mongoose hooks or explicit service calls, wired into every mutating path.
8. **API-level testing pass** — including the two new MongoDB-specific failure-mode tests.
9. **Frontend** — unchanged in scope from the original.
10. **Real-time integration** — unchanged.
11. **Full integration pass** — unchanged, plus the new MongoDB-specific scenarios.
12. **README / DECISIONS.md** — schema rationale (embedding-vs-referencing decisions now, not FK/index rationale alone), constraint-strategy honesty (which of the five are true DB-level vs. hook-level), `/assign` concurrency approach (transactions + optimistic versioning), dashboard aggregation-pipeline approach, audit log design, Parts A–D reasoning, **and the explicit MongoDB-vs-Postgres deviation justification.**
13. **Deployment** — MongoDB Atlas (M0 free tier) + Render (backend) + Vercel (frontend); verify transactions work against the Atlas-hosted replica set specifically, not just local dev.
14. **Final verification pass on the live URL** — unchanged.
15. **Loom recording** — unchanged, **but should proactively address the stack deviation** as part of the "walk through your schema design decisions" segment, since a reviewer will almost certainly ask about it otherwise.
16. **Submission** — unchanged.

---

### Open Items Requiring Recruiter Clarification Before/During Build
Everything from the original Phase 5 still applies unchanged. **The single new, highest-priority item introduced by this conversion** is confirming with the recruiter/evaluator whether a MERN/MongoDB submission is acceptable at all, given the original assignment's explicit, repeated insistence on PostgreSQL and raw SQL as the mechanism being directly graded. If no clarification is available in time, the same principle the original document closes on still applies: document your interpretation and deviation explicitly and proceed — but for a deviation this large (a different database paradigm entirely, not just an implementation detail), silence is considerably riskier here than it was for the original document's internal ambiguities.
