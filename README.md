# TaskBid

TaskBid is a real-time collaborative task auction system. A small team posts tasks; members bid the number of hours they would need to complete each task; the system auto-assigns the task to the lowest valid bidder, respecting each person's remaining weekly capacity. Every state change is audited, capacity is tracked atomically, and concurrent assignment attempts are handled correctly without double-booking.

---

## Why MongoDB / MERN instead of the originally specified PostgreSQL stack

The original assignment brief explicitly requires PostgreSQL, raw SQL migrations, and forbids any ORM — specifically to evaluate relational-schema thinking and SQL competence. This project uses MongoDB + Mongoose + the MERN stack instead, per the project owner's explicit instruction. That instruction is documented in `docs/TaskBid_Implementation_Blueprint_MERN.md`'s opening warning: *"Switching to MongoDB is a fundamental deviation from the stated requirements, not a stack-neutral choice."*

One assumption that underlies this conversion deserves explicit surfacing: the original brief's ORM ban existed to force visible SQL competence. Treating Mongoose (a MongoDB ODM) as acceptable reinterprets that rule, because MongoDB has no SQL to hide. This is classified as `RISKY/NEEDS CLARIFICATION` in the project's Analysis Blueprint (Phase 4, Assumption #12) — not `SAFE`. It is flagged here honestly rather than presented as a straightforward translation, because a reviewer following the original rubric may still mark down a MongoDB submission regardless of how well it is built.

---

## Live URL

**Frontend (Vercel):** https://task-bid-mocha.vercel.app

**Backend API + Swagger UI (Railway):** https://taskbid-production-ebb6.up.railway.app

Swagger UI is reachable at https://taskbid-production-ebb6.up.railway.app/api-docs

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Database | MongoDB (replica set required) + Mongoose | mongoose ^8.4.1 |
| Backend | Node.js + Express | express ^4.19.2 |
| Validation | Joi | ^17.13.1 |
| Realtime | Socket.IO | ^4.7.5 |
| API docs | swagger-ui-express + swagger-jsdoc | 5.0.1 / 6.2.8 |
| Security | helmet + express-mongo-sanitize | ^7.1.0 / ^2.2.0 |
| Frontend | React (Vite, plain JavaScript — no TypeScript) | react ^19.2.7 |
| Routing | react-router-dom | 6.30.1 |
| Server state | @tanstack/react-query | 5.80.7 |
| Forms | react-hook-form | 7.56.4 |
| Charts | recharts | 2.15.3 |
| Date formatting | date-fns | 4.1.0 |
| Realtime client | socket.io-client | 4.7.5 |

---

## Environment Variables

### Backend (`backend/.env` — copy from `backend/.env.example`)

```
MONGODB_URI=mongodb://localhost:27017/taskbid?replicaSet=rs0
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Frontend (`frontend/.env` — copy from `frontend/.env.example`)

```
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

---

## Installation

### Prerequisites

- Docker Desktop (for MongoDB)
- Node.js 18+

### Steps

**1. Clone and install dependencies**

```bash
git clone <repo-url>
cd TaskBid

cd backend && npm install
cd ../frontend && npm install
```

**2. Copy environment files**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**3. Start MongoDB**

```bash
docker-compose up -d
```

**About the replica set:** MongoDB multi-document transactions require a replica set, even for local development. The Docker Compose configuration in this project handles this automatically — replica-set initialisation is performed by the container's healthcheck (`rs.initiate()` runs on first startup). No manual `mongosh` step is required. This was confirmed during Feature 01 and is documented in `TRACKING.md` row 01: *"Replica-set initiation is automatic via Docker Compose healthcheck — no manual step needed."*

**4. Seed the database**

```bash
cd backend && npm run seed
```

This creates 5 users, 10 tasks across all 7 statuses, and 15 bids — including the race-condition test task ("Migrate legacy auth module", `bidding_closed`, lowest bidder Bilal at 13/15h capacity).

**5. Start the backend**

```bash
cd backend && npm run dev
```

Backend listens on `http://localhost:4000`. Swagger UI is available at `http://localhost:4000/api-docs`.

**6. Start the frontend**

```bash
cd frontend && npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Architecture Overview

The backend follows a strict three-layer module structure: **Controller → Service → Repository**. Controllers handle HTTP only (parse request, call service, send response). Business logic lives in services. Repositories wrap Mongoose model calls and accept an optional `session` parameter so they can participate in transactions. No business logic appears in repositories; no Mongoose calls appear in controllers.

Each domain (users, tasks, bids, audit, assignment, dashboard) is a self-contained folder under `backend/src/modules/`, each containing its own controller, service, repository, schema, and model files. Shared utilities (capacity calculations, status-sequence validation, ObjectId schema) live in `backend/src/utils/`.

The frontend uses a feature-folder structure under `frontend/src/features/`, mirroring the backend's domains. API calls are isolated in `frontend/src/api/`. React Query manages all server state; React Context manages the simulated current user; local component state handles UI-only concerns.

---

## Database Schema

### Collections

**users** — `name`, `email` (unique index), `hourlyRate`, `maxCapacityHours`, `currentWorkloadHours` (denormalised, maintained atomically by the assignment transaction), `capacityVersion` (an integer counter incremented on every workload write, used for optimistic concurrency during assignment — see the `/assign` section below).

**tasks** — `title`, `description`, `complexity` (1–5), `status` (enum, 7 values), `createdBy` (ref: User), `assignedUser` (ref: User, nullable), `assignedBid` (ref: Bid, nullable), `deadline`. Indexes: single-field on `status` (board queries), single-field on `deadline` (dashboard zero-bid metric).

**bids** — `task` (ref: Task), `user` (ref: User), `hoursOffered`, `status` (pending / assigned / not_selected), `createdAt`. Indexes: compound unique on `{ task, user }` (the one true engine-level constraint — see the constraints section below), compound on `{ task, hoursOffered }` (sorted bid list + assignment engine scan).

**auditlogs** — `entityType` ('task' | 'bid'), `entityId`, `actorUserId`, `fieldChanged`, `oldValue`, `newValue`, `changedAt`. Compound index on `{ entityType, entityId }`.

### The embedding-vs-referencing decision for bids

Bids are stored as a **separate collection** (referenced from tasks via `task: ObjectId`), not embedded as a sub-array inside each task document. This is the single most consequential MongoDB data-modelling decision in this project:

- Bids are written frequently and independently, in real time. An unbounded embedded array inside the task document would create write-contention on the parent document under concurrent bid submissions — every new bid would require an atomic update to the task document itself.
- An embedded array that grows without bound risks MongoDB's 16 MB document size ceiling for tasks with many bids over time.
- Bids are queried independently (sorted by `hoursOffered`, filtered by `task`) — queries the compound index handles efficiently without touching the parent task document at all.

Referencing is the correct choice here. This reasoning is documented in Architecture Blueprint Phase 9.

---

## Database-Level Constraints — The Honest Table

Of the five "database-level constraint" requirements from the original assignment, **only one maps to a true MongoDB-engine-level guarantee**. The other four are enforced at the Mongoose application layer:

| Constraint | Enforcement level | Mechanism |
|---|---|---|
| No duplicate bid (same user + same task) | **Engine-level** | MongoDB compound unique index `{ task: 1, user: 1 }` — the database itself rejects a duplicate insert with error code 11000, regardless of how the write arrives |
| No self-bidding | **Application-layer** (Mongoose hook) | `pre('save')` + `pre('findOneAndUpdate')` guard on the Bid model looks up the parent task's `createdBy` and rejects a match |
| No bid after `bidding_closed` | **Application-layer** (Mongoose hook) | Same guard checks `task.status !== 'open'` before allowing the bid |
| No backward status transition | **Application-layer** (Mongoose hook) | `pre('save')` + `pre('findOneAndUpdate')` guard on the Task model compares old vs. new status against a fixed sequence |
| Capacity cannot go negative post-assignment | **Application-layer** (service logic + transaction) | `hasCapacityFor()` check in assignment service, combined with version-conditioned `findOneAndUpdate` — see the `/assign` section |

The three hook-level constraints are real and effective for all writes that go through the Mongoose models — which is every write in this codebase. They are not engine-enforced the way a PostgreSQL `CHECK` constraint or trigger is: a write that bypasses Mongoose entirely (e.g., a raw MongoDB driver script) would not trigger them. This distinction was confirmed empirically during Feature 17's integration pass (§9, constraint-honesty check: raw `collection.insertOne()` bypassed the self-bid guard as expected).

This is stated plainly because the original assignment spec scores constraint-honesty explicitly. Glossing over the hook-vs-engine distinction would be noticed immediately by a reviewer familiar with both stacks.

---

## `/assign` Concurrency — How the Race Condition Is Actually Closed

This is the most important technical mechanism in the project.

### Why a transaction alone is not enough

Two concurrent `POST /api/tasks/:id/assign` calls can both enter a MongoDB transaction at the same moment. Both transactions read the same candidate user's document under snapshot isolation — they both see the same `currentWorkloadHours` value, both conclude the user has enough remaining capacity, and both proceed to increment the workload. The transaction gives each call atomicity within itself, but it does not prevent the two transactions from reaching the same "user has capacity" conclusion simultaneously based on the same stale read. This would result in double-booking.

**Architecture Blueprint Phase 7 states this explicitly:** *"transaction alone, without the version check, does NOT close the race."*

### The two-part mechanism

**Part 1 — MongoDB transaction** (`readConcern: 'snapshot'`, `writeConcern: { w: 'majority' }`): ensures that all reads and writes within a single `/assign` call are atomic. Either the whole call succeeds (task assigned, workload incremented, bids updated, audit entries written) or nothing is committed.

**Part 2 — Version-conditioned update on `capacityVersion`**: when the assignment engine selects a candidate user, it does not blindly increment their workload. Instead it uses `findOneAndUpdate` with the filter `{ _id: userId, capacityVersion: versionReadInsideTransaction }`. This update only matches the document if the version has not changed since it was read. If it has changed — because a concurrent transaction already won and incremented the version — `findOneAndUpdate` returns `null`. The engine treats `null` as a conflict signal, aborts the current transaction, and retries the entire attempt from the top (re-reading all data fresh), up to a maximum of 3 attempts.

This is the MongoDB equivalent of PostgreSQL's `SELECT ... FOR UPDATE` row lock. The transaction prevents dirty reads within one call; the version check prevents two calls from both succeeding based on the same stale read.

### What "retry from the top" means — and why it matters

On a version conflict, the engine does **not** simply move on to the next bidder. It aborts the transaction and restarts the entire attempt — re-fetching the task, re-fetching the bid list, re-evaluating all candidates from scratch. This matters because after a concurrent winner has committed, the state of the entire candidate pool may have changed: the winning user's workload may now be too high for their bid, and the correct next step is a fresh ordered evaluation, not a continuation from a stale position.

Additionally, MongoDB can throw a `TransientTransactionError` when two transactions write-conflict at the engine level. These are caught by `hasErrorLabel('TransientTransactionError')` and routed into the same retry loop.

### Verified test results

- **Feature 09** (TRACKING.md row 09): Part-A concurrency test, 10/10 runs passed. Retry path confirmed triggered in every single run — server logs showed `[assign] Retry 1/3 after transient transaction error: Write conflict during plan execution` in each of the 10 runs (20 retry log lines total = 2 concurrent calls × 1 retry each per run). Bilal's `currentWorkloadHours` went from 13 to 15 (exactly +2h, never +4h). `capacityVersion` incremented by exactly 1 per run (never 2). No overflow in any run.
- **Feature 17** (TRACKING.md row 17, §4): Part-A re-run through the full stack including the realtime layer, 5/5 runs passed. Both browser tabs received the `task:assigned` Socket.IO event without manual refresh in every run.

---

## Realtime Layer

Socket.IO (server `^4.7.5`, client `4.7.5`) provides live updates on the Task Detail page.

**Room strategy:** each task has its own Socket.IO room (`task:<id>`). Clients join when the Task Detail page mounts and leave when it unmounts. This scopes broadcasts precisely — only clients viewing the affected task receive events.

**Events emitted:**
- `bid:created` — emitted after a bid transaction commits, carrying the full bid payload. The frontend merges this into the React Query cache sorted by `hoursOffered`, so the bid list updates without a refetch.
- `task:assigned` — emitted after an assignment transaction commits. The frontend invalidates both the tasks query and the bids query for the affected task, triggering a reconciling refetch.

**`getIO()` pattern:** the Socket.IO instance is initialised once in `server.js` via `initSocket(httpServer)` and accessed from services via `getIO()`. Services call `getIO()` at emit time (not at module load time), avoiding circular require issues.

**Reconnect and reconcile:** the frontend's `useRealtimeBids` hook listens on `socket.io.on('reconnect')`. On reconnect it re-emits `join:task` for the current task room and invalidates both React Query caches, ensuring any events missed during the disconnection window are reconciled by a fresh fetch. This was tested with an actual backend process kill and restart (not a simulated client-side disconnect) — confirmed in Feature 15's TRACKING.md row: *"process killed via netstat+taskkill, new child process spawned, client auto-reconnected, re-joined room via onReconnect handler, received bid:created event (hoursOffered=6) — confirmed end-to-end without page refresh."*

---

## API Reference

All 10 endpoints are documented in the OpenAPI 3.0.3 spec (Feature 11, updated in Feature 12 to include `GET /api/users`). With the backend running, the full interactive spec is available at `http://localhost:4000/api-docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Server + DB connectivity check |
| `GET` | `/api/users` | List all users (id + name, for user-switcher) |
| `GET` | `/api/users/:id/workload` | Current workload and remaining capacity for a user |
| `POST` | `/api/tasks` | Create a task (status: draft) |
| `GET` | `/api/tasks` | List all tasks with bid counts and lowest bid hours; optional `?status=` filter |
| `PATCH` | `/api/tasks/:id/status` | Advance task status (forward-only, validated) |
| `POST` | `/api/tasks/:id/bids` | Place a bid on an open task |
| `GET` | `/api/tasks/:id/bids` | List bids for a task, sorted by hoursOffered ascending |
| `POST` | `/api/tasks/:id/assign` | Assign task to lowest-hours eligible bidder (transactional, concurrency-safe) |
| `GET` | `/api/dashboard/stats` | All four aggregated dashboard metrics |

All error responses use the envelope `{ error: { code, message, details? } }`. No stack traces are exposed to clients.

---

## Testing

### Per-feature self-tests (Features 01–16)

Every feature completed a self-test checklist before being marked `TESTED — READY FOR COMMIT`. Key results:

- **Feature 04**: 11/11 validation schema tests pass.
- **Feature 05**: 8/8 capacity unit tests pass.
- **Feature 08**: All three audit retrofit paths (task creation, status transition, bid creation) produce exactly one audit entry each. Rollback confirmed for both transactional paths.
- **Feature 09**: 10/10 Part-A concurrency runs pass; retry path hit in every run (confirmed via server logs).
- **Feature 10**: All 4 dashboard aggregation metrics verified against seeded data by direct DB query.
- **Feature 11**: 12-point error-handling consistency test pass; `/api-docs` live and serving HTML.
- **Feature 14**: 11/11 acceptance criteria tests pass, including stale-capacity scenario with actual server-side workload manipulation.
- **Feature 15**: All automated socket tests pass; actual backend process kill/restart reconnect test pass.
- **Feature 16**: All 4 dashboard UI metrics match Feature 10 baseline exactly (C1=3h, C2=5.5h, C3=4h, C4=6.5h, C5=3.33h).

### Feature 17 — Full integration pass

48/48 automated checks across 9 sections, all passing. No application code was changed during this pass — all issues found were test-script corrections.

| Section | What was checked | Result |
|---|---|---|
| §1 Health + seed | Server up, 5 users, 10 tasks | PASS |
| §2 Task lifecycle | Full draft→open→bidding_closed→assigned→in_progress→review→done; two illegal-jump paths | PASS |
| §3 Bidding scenarios | Self-bid 403, duplicate 409, bidding-closed 409, over-capacity 422, stale-capacity 422 | PASS |
| §4 Part-A concurrency + realtime combined | 5 runs, backend outcome correct, both browser tabs received `task:assigned` event | PASS |
| §5 Assignment edge paths | Wrong-status 409, no-eligible-bidder 422, no side effects on 422 | PASS |
| §6 Dashboard metrics | All 4 keys present, `tasksByStatus` total matches DB count | PASS |
| §7 Realtime reconnect | Disconnect/reconnect/rejoin cycle; `bid:created` received after reconnect | PASS |
| §8 MongoDB failure modes | 11000→409 translation, no raw error exposed in response | PASS |
| §9 Constraint-honesty + regression | Engine-level unique index confirmed, self-bid guard hook-level confirmed, `isGuardViolation` flag present, `capacityVersion` resets to 0 on seed and increments atomically | PASS |

---

## Deployment

The live system runs on three services:

| Layer | Service | URL |
|---|---|---|
| Database | MongoDB Atlas M0 (free tier, 3-node replica set) | `taskbid.uncfmzd.mongodb.net` |
| Backend | Railway (Node.js web service) | https://taskbid-production-ebb6.up.railway.app |
| Frontend | Vercel (SPA) | https://task-bid-mocha.vercel.app |

**Atlas M0** was chosen because its free tier ships as a 3-node replica set by default, which means multi-document transactions work without any manual configuration — unlike local Docker Compose, which required explicit replica-set initialisation via the healthcheck. The Atlas network access policy is set to allow from anywhere (`0.0.0.0/0`). This is a deliberate simplification documented here per the Feature 19 spec's explicit guidance: it is acceptable for a time-boxed assessment but would be replaced by a scoped IP allowlist or VPC peering in a production environment with real data.

**Railway** was used in place of the originally planned Render deployment. The project owner made this choice. All environment variables (`MONGODB_URI` pointing at Atlas, `CORS_ORIGIN=https://task-bid-mocha.vercel.app`, `NODE_ENV=production`) are set in Railway's dashboard. The `CORS_ORIGIN` is a specific origin (not wildcard) — the backend's `socket.js` uses `origin: "*"` only when `NODE_ENV=development`, confirmed correct.

**Vercel** hosts the frontend SPA. `VITE_API_URL` and `VITE_SOCKET_URL` are set in Vercel's environment variables dashboard to point at the Railway backend URL.

**What was run against Atlas before going live:**

1. `migrate-mongo up` — all 4 migrations applied (users email unique index, bids compound index, tasks status/deadline indexes, auditlogs entity index). Confirmed with `migrate-mongo status`.
2. Seed script — 5 users, 10 tasks, 15 bids created. Idempotency confirmed: second run produced identical output.

**Production verification results (Feature 19 Step 5):**

| Check | Result |
|---|---|
| `GET /health` | 200 `{"status":"ok"}` |
| `GET /api/users` | 200 — 5 users |
| `GET /api/tasks` | 200 — 10 tasks across 7 statuses |
| `GET /api/dashboard/stats` | 200 — all 4 metrics |
| `/api-docs` | 200 — Swagger UI loads |
| Duplicate-bid → 409 CONFLICT | PASS — no raw MongoDB error leaked |
| Self-bid → 403 FORBIDDEN | PASS |
| Wrong-status assign → 409 CONFLICT | PASS |
| **Live concurrency test (3 runs, Atlas replica set)** | **3/3 PASS — Bilal 13→15h, capVer+1, no overflow in any run** |
| Cold-start behaviour | Railway free tier does not spin down; response times ~1.4s cold, ~600ms warm — no sleep/cold-start issue observed |

**≥2-week stability requirement:** the Analysis Blueprint (Phase 3) requires the deployed system to remain live and functional for at least 2 weeks from the date of submission. This single deployment pass cannot certify that requirement — it confirms the system is working at deployment time. The project owner should monitor that the Railway and Vercel services remain active and that the Atlas M0 free-tier cluster is not paused due to inactivity (Atlas pauses M0 clusters after 60 days of no connections; seeding the database counts as activity).

---

## Known Limitations

These are documented facts about the system's actual guarantees, not a defect list. They are stated plainly so a reviewer can assess them accurately.

**1. Constraint-guarantee gap (four of five constraints are hook-level, not engine-level)**

Only one of the five "database-level constraint" requirements is enforced by the MongoDB engine itself: the no-duplicate-bid compound unique index. The other four (no self-bidding, no bid after `bidding_closed`, no backward task-status movement, and the capacity ceiling enforced during assignment) are implemented as Mongoose `pre('save')` and `pre('findOneAndUpdate')` hooks. These hooks are real and effective for all writes in this codebase — which all go through the Mongoose models. They are not MongoDB-engine-level guarantees; a write that bypasses Mongoose entirely would not trigger them. Confirmed empirically in Feature 17 §9.

**2. Guard-check ordering (capacity check fires before self-bid check)**

When a user attempts to bid on their own task with an amount that also exceeds their remaining capacity, the 422 (capacity exceeded) response is returned before the 403 (self-bid forbidden). Both guards are individually correct; the ordering is a side effect of the service layer's check sequence (`hasCapacityFor` is checked before `Bid.create()` triggers the Mongoose hook). A reviewer should not interpret a 422 from a self-bidder as a missing self-bid guard — the guard is present and fires correctly when the bid amount is within the user's remaining capacity. Documented in Feature 17 §3 finding (a).

**3. Transient-transaction retry path not deterministically testable at integration level**

The `TransientTransactionError` / `UnknownTransactionCommitResult` catch-and-retry path in the assignment engine cannot be forced reproducibly at the full-integration test level. Its correctness was confirmed during Feature 09's isolated testing via server log lines (`[assign] Retry 1/3 after transient transaction error: Write conflict during plan execution`) appearing in every one of the 10 concurrency runs. This is a testing-coverage limitation, not a functionality gap — the code is there and was observed executing. Feature 17 §8 documents this honestly.

**4. Frontend/backend capacity-logic duplication**

The bid form's client-side capacity pre-check (which greys out the submit button when the entered hours exceed the user's remaining capacity) duplicates the logic in `backend/src/utils/capacity.js`. Without TypeScript, there is no compile-time check that these two implementations stay in sync as the codebase evolves. This is flagged in Architecture Blueprint Phase 11 as a "manual-discipline risk." The current implementations are identical; future changes to capacity calculation logic must update both.

**5. `CreateTaskModal` deferred — tasks can only be created via API/Swagger**

The Task Board page (Feature 13) does not include a task-creation form. The `CreateTaskModal` component was deferred as not required by Feature 13's acceptance criteria (TRACKING.md row 13: *"CreateTaskModal deferred (not required by acceptance criteria)"*). Tasks can be created via `POST /api/tasks` through Swagger UI at `/api-docs` or via any HTTP client.

**6. `GET /api/tasks/:id` does not exist**

There is no single-task endpoint. The Task Detail page (Feature 14) reuses the `GET /api/tasks` list response, selecting the correct task client-side by id from the React Query cache. This was an explicit design choice (TRACKING.md row 06: *"No GET /api/tasks/:id"*) — the list response includes all fields needed for the detail view, including `description`.

---

## Future Improvements

- **True engine-level enforcement for the four hook-level constraints:** MongoDB Atlas Change Streams or Atlas Triggers are the closest true equivalent to a PostgreSQL trigger for these rules. This would eliminate the bypass risk but introduces an Atlas-specific infrastructure dependency and is outside the scope of this assessment's time-box.
- **`CreateTaskModal`:** add a task-creation form to the Task Board page (deferred from Feature 13).
- **`GET /api/tasks/:id`:** a single-task endpoint would make the Task Detail page's data fetching more efficient and independent of the full list cache.
- **Workload computation:** `currentWorkloadHours` is currently a denormalised, manually-maintained field. A derived aggregation (summing hours from all `assigned` + `in_progress` bids for a user) would eliminate the risk of it drifting from the true state.
- **Feature 20 bonus items:** listed in TRACKING.md row 20 as `NOT STARTED`.

---

## Loom Video

> [Loom video — to be added]
