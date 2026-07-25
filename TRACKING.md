# TaskBid — Build Tracking

> Updated by the Coding Agent after every completed feature. Read this before starting any task.
> Status values: `NOT STARTED` → `IN PROGRESS` → `READY FOR TEST` → `TESTED — READY FOR COMMIT` → `COMMITTED`

| # | Feature | MD File | Status | One-line Summary | Notes / Deviations |
|---|---|---|---|---|---|
| 01 | Project Setup (repo, Docker Compose w/ replica set, env config) | `docs/features/01-project-setup.md` | TESTED — READY FOR COMMIT | Replica set confirmed ok:1 (healthcheck auto-init). Backend Express skeleton + /health route. Deps installed, .env from .env.example. | Replica-set initiation is automatic via Docker Compose healthcheck — no manual step needed. |
| 02 | Database Schema (Mongoose models: users, tasks, bids, auditlogs) | `docs/features/02-database-schema.md` | TESTED — READY FOR COMMIT | All 4 models + guard hooks implemented. Added pre('findOneAndUpdate') guard to both Task and Bid models (Feature 02 updated spec). 4 migrations applied. Indexes verified via mongosh. | Only 1 of 5 constraints (bid unique index) is true DB-engine-level. Guard hooks now cover both pre('save') and pre('findOneAndUpdate'). **Known minor gap (accepted, non-blocking):** see deviations log below. |
| 03 | Seed Script | `docs/features/03-seed-script.md` | TESTED — READY FOR COMMIT | Seed rewritten with correct pattern: tasks start 'open', Bid.create() while open, status advanced via setStatus()+save(). All 7 statuses covered incl. review. 5 users / 10 tasks / 15 bids. Idempotent (ran twice, same result). | Race-condition test task: 'Migrate legacy auth module' (bidding_closed), lowest bidder Bilal (2h) — a near-capacity user, confirmed suitable for Feature 09's Part-A test. Near-capacity users: Bilal (13/15h), Usman (8/10h). |
| 04 | Validation Schemas (Joi, shared middleware) | `docs/features/04-validation.md` | TESTED — READY FOR COMMIT | validate middleware (abortEarly:false, coerces req[target]), currentUser middleware (missing/malformed/nonexistent → 400), objectIdSchema util, tasks.schema.js, bids.schema.js, users.schema.js. mongoSanitize already wired in app.js. 11/11 self-tests pass. | No deviations from Blueprint Phase 5/13. |
| 05 | Users Module (workload endpoint) | `docs/features/05-users-module.md` | TESTED — READY FOR COMMIT | capacity.js (getRemainingCapacity, hasCapacityFor — pure, no DB), users.repository.js, users.service.js, users.controller.js. GET /api/users/:id/workload mounted. 8/8 capacity unit tests pass. Live endpoint: valid→200, nonexistent→404, malformed→400. | No deviations. ESLint clean (0 errors). |
| 06 | Tasks Module (create, status transition, list) | `docs/features/06-tasks-module.md` | TESTED — READY FOR COMMIT | tasks.repository/service/controller. POST /api/tasks, PATCH /api/tasks/:id/status, GET /api/tasks (+ optional ?status= filter). Mounted in app.js. Service-level isLegalForwardTransition check + setStatus()+save(). 8/8 self-tests pass. | Option (a) for GET — no bid-count/lowest-bid yet (revisit Feature 07). No GET /api/tasks/:id (list sufficient for now; add in Feature 14 if detail page needs it). Audit-log wiring deferred to Feature 08. Minor fix: added stripUnknown:true to validate middleware so POST ignores extraneous body fields (status/createdBy) per acceptance criteria. |
| 07 | Bids Module (place bid, list bids) | `docs/features/07-bids-module.md` | TESTED — READY FOR COMMIT | bids.repository/service/controller. POST+GET /api/tasks/:id/bids mounted in app.js. placeBid uses hasCapacityFor (soft 422), translateBidCreateError maps guard hooks + MongoDB 11000. GET /api/tasks extended with bidCount/lowestBidHours via bids.repository getBidSummaryForTasks. 9/9 self-tests pass. | Feature 06 follow-up closed (option a bid fields). Audit-log wiring deferred to Feature 08. No status/assignment mutation. ESLint clean (0 errors). |
| 08 | Audit Log Module | `docs/features/08-audit-module.md` | NOT STARTED | — | — |
| 09 | Assignment Engine (transaction + optimistic concurrency) | `docs/features/09-assignment-engine.md` | NOT STARTED | — | — |
| 10 | Dashboard Module (aggregation pipelines) | `docs/features/10-dashboard-module.md` | NOT STARTED | — | — |
| 11 | Swagger/OpenAPI Setup + Backend Error Handling Pass | `docs/features/11-swagger-error-handling.md` | NOT STARTED | — | — |
| 12 | Frontend Setup (Vite, routing, layout, user-switcher) | `docs/features/12-frontend-setup.md` | NOT STARTED | — | — |
| 13 | Task Board Page | `docs/features/13-task-board.md` | NOT STARTED | — | — |
| 14 | Task Detail Page + Bid Form | `docs/features/14-task-detail.md` | NOT STARTED | — | — |
| 15 | Realtime Layer (Socket.IO, both sides) | `docs/features/15-realtime.md` | NOT STARTED | — | — |
| 16 | Dashboard Page + Chart | `docs/features/16-dashboard-ui.md` | NOT STARTED | — | — |
| 17 | Full Integration Pass + Concurrency Test | `docs/features/17-integration-testing.md` | NOT STARTED | — | — |
| 18 | README + DECISIONS.md | `docs/features/18-readme-decisions.md` | NOT STARTED | — | — |
| 19 | Deployment (Atlas + Render + Vercel) | `docs/features/19-deployment.md` | NOT STARTED | — | — |
| 20 | Bonus Items (if time remains) | `docs/features/20-bonus.md` | NOT STARTED | — | — |

---

## Current Focus
**Feature #07 — TESTED — READY FOR COMMIT.** Next: Feature 08 (Audit Log Module).

## Blocked Items
None.

## Deviations From Blueprint (running log)
- **Decision (found during Feature 02/03 implementation review):** Feature 02's guard hooks (self-bid, bidding-open, forward-only-status) must be duplicated as `pre('findOneAndUpdate')` query middleware, not just `pre('save')` document middleware — otherwise any service/script using `updateOne`/`findOneAndUpdate` silently bypasses them with no error. **Applies to every future feature:** Features 06, 07, and 09 must always use fetch-then-`.save()` (with `task.setStatus()` for status changes) for anything these guards protect, never a raw `updateOne`/`findOneAndUpdate` shortcut — the one documented exception is Feature 09's assignment engine, whose entire optimistic-concurrency mechanism is intentionally built on a conditional `findOneAndUpdate` against the `users` collection specifically (not `tasks`/`bids`), which has no guard hook of this kind to bypass in the first place.
- Raw `.collection.insertMany()`/`.insertOne()` (bypassing Mongoose entirely) must never be used anywhere in this codebase for `tasks`/`bids`/`users` documents, including in the seed script — see Feature 03's corrected data-creation pattern.
- **Known minor gap, accepted as non-blocking (found during Feature 02 sign-off review):** in `bids.model.js`, the `pre('findOneAndUpdate')` guard's shared `runSelfBidAndOpenCheck()` helper is called with a hardcoded `session: null` for its Task lookup, regardless of whether the `findOneAndUpdate` call triggering it is itself running inside an active transaction. This means that specific lookup always reads outside the transaction's snapshot. Accepted for now because, per Feature 02's own spec, this particular guard is a defensive backstop for `Bid` documents — bids are expected to be created via `save()`/`create()`, not updated later, so this code path is not expected to trigger often in practice. **If Feature 07 or Feature 09 ever ends up calling `Bid.findOneAndUpdate()` with `task`/`user` fields inside a transaction as part of normal operation (not just as a defensive edge case), this gap must be revisited and the helper updated to accept and use the active session.**
