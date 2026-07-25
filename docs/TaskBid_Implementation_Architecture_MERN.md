# TaskBid — Implementation Architecture Blueprint (MERN Stack Version)
### Production-quality build guide, adapted to MongoDB, Express, React, Node.js — plain JavaScript
No code. Every decision made explicitly — no "it depends."

> ⚠️ **Same flag as the Analysis Blueprint:** the original assignment mandates PostgreSQL + raw SQL and forbids ORMs specifically to grade schema/SQL skill. This document converts every decision to its MERN equivalent as requested, with nothing dropped, but several "database-level constraint" and "SQL proficiency" items are now honestly weaker or reframed guarantees under MongoDB — each is called out explicitly where it occurs rather than glossed over.

---

## PHASE 1 — Architecture Decisions

| # | Decision | Reason | Alternative | Why Rejected | Confidence |
|---|---|---|---|---|---|
| 1 | **Backend architecture: layered (Controller → Service → Repository)**, single Express app, modular by feature — unchanged from the SQL version | Same scale rationale as before; repositories now wrap Mongoose model calls instead of Knex queries, keeping data-access code in one reviewable place | Full hexagonal/clean architecture; microservices | Same as original — unnecessary ceremony; microservices explicitly forbidden | High |
| 2 | **Frontend architecture: feature-folder React SPA** (Vite + React Router), plain JavaScript (`.jsx`, no `.tsx`) | No SSR/SEO need; fast iteration; avoids TypeScript build-config overhead per your stack choice | Next.js; TypeScript-based Vite setup | Next.js still unneeded (Phase 1 #2 of original); TypeScript explicitly excluded per your instruction | High |
| 3 | **Repository pattern for all DB access** — one repository module per entity, wrapping Mongoose model calls | Isolates Mongoose/query logic from business logic; gives reviewers one clear place per entity to assess data-access competence (the MERN analogue of "we want to see your SQL" — here it's "we want to see your data-modeling and aggregation-pipeline skill") | Inline Mongoose calls directly in services | Scatters query logic, harder to review/test in isolation — same reasoning as original | High |
| 4 | **State management: TanStack React Query for server state; React Context for current-user; local component state for UI-only state** | Unchanged reasoning from the original — none of this is backend-stack-dependent | Redux Toolkit / Zustand for everything | Same as original — over-engineered for this data volume | High |
| 5 | **Realtime solution: WebSocket via Socket.IO**, room-per-task | Unchanged — Socket.IO's built-in reconnect/backoff is independent of the database choice | SSE; polling | Same as original | Medium |
| 6 | **Validation library: Joi**, single schema per module, used for request validation on the server | Zod's ergonomics lean TypeScript-first; Joi is the more idiomatic, widely-used choice in plain-JavaScript Express/MERN codebases and has no dependency on a type-inference system we're no longer using | Zod (usable in JS but designed around TS inference); express-validator | Zod's main advantage (driving TS types) doesn't apply without TypeScript; express-validator is a reasonable alternative but Joi's schema-object style maps more directly onto the original document's DTO-per-module structure | High |
| 7 | **Error handling: typed domain error classes (plain JS classes extending `Error`) + centralized Express error middleware**, uniform JSON error envelope | Same reasoning as original — one place to reason about status-code mapping; additionally must translate Mongoose/MongoDB-native errors (validation errors, duplicate-key code 11000, transient transaction errors) into the same domain error types | Ad hoc try/catch per route | Same as original — inconsistent, easy to miss cases | High |
| 8 | **Logging: structured console logging (pino)**, no external log aggregation service | Unchanged from original | Full ELK/Datadog setup | Explicitly out of scope, same as original | High |
| 9 | **Environment management: dotenv locally, platform env vars in production** | Unchanged, `MONGODB_URI` replaces `DATABASE_URL` | Config-as-code / secret manager | Unnecessary for this scope | High |
| 10 | **Database strategy: single MongoDB deployment, configured as a replica set (required for multi-document transactions), schema managed via Mongoose models + `migrate-mongo` for ordered, numbered schema/index change tracking** | Mongoose gives schema validation, indexes, and a familiar ODM API; `migrate-mongo` preserves the "numbered, ordered migration files" spirit the original spec explicitly required, even though MongoDB doesn't strictly need a migration runner to function | No ODM, raw MongoDB driver only; no migration tool, ad hoc index creation | Raw driver loses schema validation convenience with no compensating benefit at this scale; skipping a migration tool loses the explicit "numbered and ordered" documentation trail the original spec asked for | Medium — using an ODM here is itself a deviation from the original ban-on-ORMs instruction; documented as such |
| 11 | **Transaction strategy: MongoDB multi-document ACID transactions (`session.startTransaction()`) combined with optimistic concurrency control via a version counter field on the contested `users` document**, rather than any row-level-lock equivalent (MongoDB has none identical to Postgres `FOR UPDATE`) | This is the closest correct MERN analogue to the original's explicit locking design — full reasoning in Phase 7 | Rely on transactions alone with no version check (last-write-wins) | Plain transactions without a conditional/version-checked update do **not** by themselves prevent the Part-A race the way Postgres's row lock did — MongoDB's transaction isolation (snapshot-based) prevents dirty reads within the transaction but does not serialize two *separate* concurrent transactions' writes to the same document without an explicit conditional-update check; this must be paired with the version-based conditional write to actually close the race | Medium — this is the single most important, most-scrutiny-worthy decision in the whole MERN conversion and should be demonstrated, not just asserted |
| 12 | **Deployment strategy: MongoDB Atlas (M0 free tier, replica-set by default) + Render (backend) + Vercel (frontend)** | Matches the spirit of the original's free-tier-friendly deployment guidance; Atlas's free tier conveniently ships as a replica set already, which transactions require | Self-hosted MongoDB on Render | Render doesn't offer a managed, replica-set-ready free MongoDB the way Atlas does; self-hosting a replica set on a free container is fragile and effort-intensive for no benefit | High |

---

## PHASE 2 — Technology Stack

| Technology | Purpose | Why Chosen | Alternative | Reason Rejected | Version |
|---|---|---|---|---|---|
| Node.js | Backend runtime | Required by MERN stack choice | — | — | 20 LTS |
| JavaScript (ES2022+) | Language, both sides | Per your explicit instruction — no TypeScript | TypeScript | Explicitly excluded per your stack decision | — |
| Express | HTTP framework | Same reasoning as original — minimal ceremony for a 7–8 endpoint API | Fastify | Same as original — smaller ecosystem familiarity gain not worth it here | 4.x |
| MongoDB | Database | Required by your MERN stack choice | PostgreSQL (original spec) | Explicitly being replaced per your instruction | 7.x / Atlas-managed |
| Mongoose | ODM | Gives schema definition, validation, indexes, and a familiar model API; the standard, idiomatic choice for MongoDB in a MERN app | Raw MongoDB Node driver | Raw driver means hand-rolling schema validation and losing convenient model-level hooks used for the constraint-emulation strategy in Phase 8 | Mongoose 8.x |
| migrate-mongo | Ordered schema/index change tracking | Preserves the "numbered, ordered migration files" requirement from the original spec even though Mongo doesn't require a migration tool to function | Ad hoc scripts, no tracking | Loses the explicit documentation trail the original assignment asked for | 10.x |
| Joi | Validation | See Phase 1 #6 | Zod, express-validator | See Phase 1 #6 | Joi 17.x |
| Socket.IO | Realtime | Unchanged from original | Native `ws`, SSE | Unchanged reasoning | Socket.IO 4.x |
| React | Frontend UI | Required by MERN | — | — | 18.x |
| Vite | Frontend build tool | Same reasoning as original, JS template instead of TS template | Next.js, CRA | Same as original | Vite 5.x |
| React Router | Routing | Unchanged | TanStack Router | Unchanged reasoning | React Router 6.x |
| TanStack React Query | Server state / caching | Unchanged | SWR | Unchanged reasoning | 5.x |
| Recharts | Charting | Unchanged | Chart.js, Nivo | Unchanged reasoning | 2.x |
| Tailwind CSS | Styling | Unchanged | MUI, Chakra | Unchanged reasoning | 3.x |
| React Hook Form | Forms | Unchanged, resolver now uses a Joi-compatible resolver (`@hookform/resolvers/joi`) instead of the Zod resolver | Formik | Unchanged reasoning | RHF 7.x |
| date-fns | Date handling | Unchanged | Moment.js | Unchanged reasoning | date-fns 3.x |
| Jest | Testing (both unit and integration) | Standard, mature choice for plain-JS Node/Express projects; more idiomatic in a non-Vite-coupled backend than Vitest, and equally usable on the React frontend via `@testing-library/react` | Vitest | Vitest's main draw (native Vite integration) is a frontend-only benefit; Jest's ubiquity in plain-JS MERN tutorials/codebases makes it the lower-friction default here | Jest 29.x |
| ESLint (JS config, no typescript-eslint) | Linting | Standard | — | — | ESLint 9.x |
| Prettier | Formatting | Unchanged | — | — | 3.x |
| Docker Compose | Local dev environment | Now provisions a **single-node MongoDB replica set** (via an init script/command run against the `mongod` container) instead of a plain Postgres container — required specifically to unlock transaction support locally | Manual local MongoDB install | Fails "must work with docker-compose up" and loses replica-set-on-first-run convenience | Compose v2 |
| Vercel | Frontend deployment | Unchanged | Netlify | Unchanged reasoning | — |
| Render | Backend deployment | Unchanged | Railway | Unchanged reasoning | — |
| MongoDB Atlas | Database hosting | Replaces Neon — free M0 tier is a replica set by default, which transactions require | Self-hosted Mongo on a VM/container | Self-hosting a reliable replica set on a free tier is fragile and not worth the effort here | — |

---

## PHASE 3 — Project Folder Structure

```
taskbid/
├── docker-compose.yml              # MongoDB single-node replica-set service for local dev
├── .env.example                    # documents all required env vars (MONGODB_URI, etc.)
├── README.md
├── DECISIONS.md                    # Parts A–D write-ups + architecture rationale + stack-deviation note
├── backend/
│   ├── src/
│   │   ├── config/                 # env loading/validation, single source of app config
│   │   ├── db/
│   │   │   ├── connection.js       # Mongoose connection singleton
│   │   │   ├── migrations/         # migrate-mongo files, numbered (001_..., 002_..., ...) — schema/index changes
│   │   │   └── seeds/              # seed.js — demo data covering every scenario, run via `node seed.js`
│   │   ├── modules/
│   │   │   ├── users/
│   │   │   │   ├── users.model.js       # Mongoose schema/model
│   │   │   │   ├── users.controller.js
│   │   │   │   ├── users.service.js
│   │   │   │   ├── users.repository.js
│   │   │   │   └── users.schema.js      # Joi schemas for this module
│   │   │   ├── tasks/
│   │   │   │   ├── tasks.model.js
│   │   │   │   ├── tasks.controller.js
│   │   │   │   ├── tasks.service.js
│   │   │   │   ├── tasks.repository.js
│   │   │   │   └── tasks.schema.js
│   │   │   ├── bids/
│   │   │   │   ├── bids.model.js
│   │   │   │   ├── bids.controller.js
│   │   │   │   ├── bids.service.js
│   │   │   │   ├── bids.repository.js
│   │   │   │   └── bids.schema.js
│   │   │   ├── assignment/
│   │   │   │   ├── assignment.controller.js
│   │   │   │   ├── assignment.service.js   # transaction + optimistic-concurrency logic lives here
│   │   │   │   └── assignment.repository.js
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.controller.js
│   │   │   │   ├── dashboard.service.js
│   │   │   │   └── dashboard.repository.js  # aggregation pipelines live here
│   │   │   └── audit/
│   │   │       ├── auditlog.model.js
│   │   │       ├── audit.service.js        # single write-path used by all mutating services
│   │   │       └── audit.repository.js
│   │   ├── realtime/
│   │   │   ├── socket.js           # Socket.IO server setup, room join/leave
│   │   │   └── events.js           # event name constants + payload shape comments (JSDoc, no types)
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   ├── currentUser.js      # resolves switcher-selected user id
│   │   │   ├── validate.js         # generic Joi-schema-validating middleware
│   │   │   ├── mongoSanitize.js    # strips $-prefixed keys from input (NoSQL-injection guard)
│   │   │   └── cors.js
│   │   ├── errors/
│   │   │   └── domainErrors.js     # ValidationError, NotFoundError, ConflictError, ForbiddenError (plain JS classes)
│   │   ├── utils/
│   │   │   ├── capacity.js         # single source of truth for workload/remaining-capacity math
│   │   │   └── logger.js
│   │   └── app.js / server.js      # Express app assembly, server bootstrap
│   ├── package.json
│   └── jsconfig.json                # optional, for editor path/intellisense help without full TS
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── TaskBoardPage.jsx
│   │   │   ├── TaskDetailPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── features/
│   │   │   ├── tasks/
│   │   │   ├── bids/
│   │   │   ├── assignment/
│   │   │   └── dashboard/
│   │   ├── components/
│   │   ├── context/
│   │   │   └── CurrentUserContext.jsx
│   │   ├── hooks/
│   │   ├── api/
│   │   │   ├── client.js
│   │   │   ├── tasks.api.js
│   │   │   ├── bids.api.js
│   │   │   └── dashboard.api.js
│   │   ├── realtime/
│   │   │   └── socket.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
```

**Responsibility notes (unchanged principles, MERN-specific detail added):**
- `modules/*/[entity].model.js`: the Mongoose schema definition **is** the closest MERN equivalent of a SQL migration's `CREATE TABLE` statement — validators, defaults, and indexes are declared here. **Never** put business logic inside a Mongoose schema method beyond simple derived getters.
- `db/migrations/`: reserved specifically for **index creation/changes** and any one-off data-backfill scripts — since Mongoose model files already define the shape, migrations here exist mainly to give reviewers the same "numbered, ordered, replayable change history" experience the original spec asked for, not to define the schema itself.
- `assignment.service.js`: the single place the version-counter optimistic-concurrency logic lives — **never** duplicate this conditional-update pattern anywhere else.
- `middleware/mongoSanitize.js`: new folder entry with no SQL equivalent — necessary specifically because MongoDB's NoSQL-injection risk (Phase 15) has no counterpart in the original Postgres version.

---

## PHASE 4 — Database Blueprint (Mongoose Schemas, No Code)

**users**
| Field | Type | Nullable | Default | Unique | Notes |
|---|---|---|---|---|---|
| _id | ObjectId | no | auto | PK | Mongo-native |
| name | String | no | — | no | |
| email | String | no | — | yes (unique index) | |
| hourlyRate | Number | no | — | no | |
| maxCapacityHours | Number | no | — | no | supports decimals |
| currentWorkloadHours | Number | no | 0 | no | denormalized, transactionally maintained |
| capacityVersion | Number | no | 0 | no | **new field, MERN-specific** — incremented on every workload write, used for optimistic-concurrency conditional updates during assignment (Phase 7) |
| createdAt / updatedAt | Date | no | auto (`timestamps: true`) | no | Mongoose's built-in timestamp option |

*Reasoning:* `capacityVersion` is the direct MERN substitute for what a Postgres row lock gave "for free" — since MongoDB has no exact `SELECT ... FOR UPDATE` equivalent across two independent transactions, the version field lets a conditional `findOneAndUpdate` fail (rather than silently overwrite) if another process changed this user's workload since it was last read.

**tasks**
| Field | Type | Nullable | Default | Unique | Notes |
|---|---|---|---|---|---|
| _id | ObjectId | no | auto | PK | |
| title | String | no | — | no | |
| description | String | yes | null | no | |
| complexity | Number | no | — | no | Mongoose `min: 1, max: 5` validator |
| status | String | no | 'draft' | no | Mongoose `enum` validator, six lifecycle values |
| createdBy | ObjectId (ref: 'User') | no | — | no | |
| assignedUser | ObjectId (ref: 'User') | yes | null | no | set only at assignment |
| assignedBid | ObjectId (ref: 'Bid') | yes | null | no | denormalized for fast lookups |
| deadline | Date | no | — | no | |
| createdAt / updatedAt | Date | no | auto | no | |

*Indexes:* single-field index on `status` (board queries), single-field index on `deadline` (zero-bid-past-deadline dashboard metric).
*Constraints:* Mongoose schema validators (complexity range, status enum) enforce at the application/ODM layer, not the true database engine layer — flagged consistently with Phase 8/14's honesty note.

**bids**
| Field | Type | Nullable | Default | Unique | Notes |
|---|---|---|---|---|---|
| _id | ObjectId | no | auto | PK | |
| task | ObjectId (ref: 'Task') | no | — | part of compound unique index | |
| user | ObjectId (ref: 'User') | no | — | part of compound unique index | |
| hoursOffered | Number | no | — | no | Mongoose `min: 0.01` (exclusive-positive) validator |
| status | String | no | 'pending' | no | enum: pending / assigned / not_selected |
| createdAt | Date | no | auto | no | |

*Unique constraint:* **compound unique index** on `{ task: 1, user: 1 }` — this is a true database-engine-level guarantee (MongoDB itself rejects the second insert with error code 11000), the direct and honest equivalent of the SQL `UNIQUE` constraint, and the one constraint in this whole schema that maps cleanly.
*Indexes:* compound index `{ task: 1, hoursOffered: 1 }` for the ascending-sort retrieval and the assignment engine's ordered scan.

**auditlogs**
| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| _id | ObjectId | no | auto | |
| entityType | String | no | — | 'task' \| 'bid' |
| entityId | ObjectId | no | — | not a `ref` to any single collection — polymorphic, same documented trade-off as the SQL version |
| actorUserId | ObjectId (ref: 'User') | yes | null | |
| fieldChanged | String | yes | null | null for full-document inserts |
| oldValue | Mixed (Schema.Types.Mixed) | yes | null | flexible type, mirrors the original's "text/jsonb for flexibility" choice |
| newValue | Mixed | yes | null | |
| changedAt | Date | no | auto (`default: Date.now`) | |

*Indexes:* compound index `{ entityType: 1, entityId: 1 }` for entity history lookups.

---

## PHASE 5 — API Contract Blueprint

Endpoint surface, request/response shapes, and business rules are **unchanged from the original SQL version** — every one of these is HTTP/business-logic detail, not database-technology detail. The only substitution: every validation step that previously said "Zod schema" now reads "Joi schema," and every "DB constraint" reference should be read alongside the Phase 8 honesty table (native vs. hook-level enforcement) below rather than assumed equivalent.

One addition specific to MongoDB: **POST /api/tasks/:id/assign**'s error list must include a distinct case for a caught `TransientTransactionError`/`UnknownTransactionCommitResult` (MongoDB-specific transaction contention errors) — recommend surfacing these as a 503 "please retry" after the app's own bounded internal retry attempts are exhausted, rather than a generic 500, since they represent expected, recoverable contention rather than a genuine fault.

(The inferred `GET /api/tasks` addition and `GET /health` addition from the original document still apply unchanged — both are backend-technology-agnostic.)

---

## PHASE 6 — Backend Module Design

Unchanged in layering/responsibility from the original (Controller → Service → Repository, thin controllers, business rules in services, persistence-only repositories) with these MERN-specific substitutions:

- **Repositories** now wrap Mongoose model methods (`Model.find()`, `Model.findById()`, `Model.findOneAndUpdate()` with conditional filters for optimistic concurrency) instead of Knex query-builder calls; repositories accept an optional Mongoose `session` parameter so they can be composed inside a service's transaction — the direct MERN analogue of the original's "accepts an optional transaction object."
- **Validation/DTOs** — Joi schemas live alongside each module (`*.schema.js`); since there's no TypeScript type-inference step, the Joi schema is the *only* source of truth for shape (documented as a real, if minor, loss relative to the original's Zod-schema-doubles-as-TS-type approach).
- **Configuration** — `config/index.js` loads/validates env vars at boot via a small Joi schema, same fail-fast principle as original.
- **Error handling** — the central error middleware now additionally contains a Mongoose/MongoDB-error-translation step: catching Mongoose `ValidationError` → `ValidationError` (app), MongoDB `code: 11000` → `ConflictError`, and MongoDB transient transaction errors → a retry-then-503 path.

---

## PHASE 7 — Transaction Architecture (Core Section — Most Important, Most Changed by the Stack Switch)

**Where transactions are required:** same three write-paths as the original (`/assign`, status transition + audit write, bid insert + audit write) — the *need* for atomicity is business-driven, not database-driven, so this list is unchanged.

**The `/assign` algorithm, step by step (MongoDB version):**
1. Start a MongoDB session and begin a transaction (`session.startTransaction()`), with `readConcern: 'snapshot'` and `writeConcern: { w: 'majority' }` — the deliberate, documented choice mirroring the original's isolation-level decision.
2. Re-fetch the task **within the session** (`Task.findById(id).session(session)`); verify `status === 'bidding_closed'` (if not, abort transaction, return 409).
3. Fetch all bids for the task ordered ascending by `hoursOffered` (`Bid.find({ task: id }).sort({ hoursOffered: 1 }).session(session)`), using the `{ task, hoursOffered }` compound index.
4. Iterate candidates in order. For each candidate bid:
   a. Read the candidate's `users` document **within the session** (`User.findById(candidate.user).session(session)`), capturing its current `currentWorkloadHours`, `maxCapacityHours`, and `capacityVersion`.
   b. Check in application code whether `currentWorkloadHours + bid.hoursOffered <= maxCapacityHours`.
   c. If capacity is sufficient: attempt a **conditional update** — `User.findOneAndUpdate({ _id: candidate.user, capacityVersion: readVersion }, { $inc: { currentWorkloadHours: bid.hoursOffered, capacityVersion: 1 } }, { session, new: true })`. This is the critical step: the filter includes the exact `capacityVersion` that was just read, so if any other process changed this user's workload (and thus bumped the version) between the read in step (a) and this update, the conditional update matches **zero documents** and returns `null`.
      - If the update **succeeds** (a document was returned): this candidate wins. Update the task's `status = 'assigned'`, `assignedUser`, `assignedBid`; update the winning bid's `status = 'assigned'`; update all other bids on this task to `status = 'not_selected'`; write audit documents for the task and bid changes — all within the same session. Commit the transaction. Return success.
      - If the update **fails** (returned `null`, meaning the version had already moved): this indicates a genuine concurrent conflict on this exact user — abort the current transaction entirely and **retry the whole `/assign` call from step 1** (bounded to, e.g., 3 attempts), since the underlying data (workload, other bids) may now be different and needs a fresh read. This retry-on-version-conflict loop is the direct MERN analogue of a transaction blocking on a Postgres row lock and then proceeding once unblocked — the mechanics differ (retry-after-failure vs. block-then-proceed) but the *outcome guarantee* is the same.
   d. If capacity is insufficient (from the plain read in step (b), no conflict involved): move to the next candidate in the loop, repeating from step (a).
5. If no candidate has sufficient capacity: abort the transaction (no writes were committed), return 422 "no eligible bidder."

**Why this two-part mechanism (transaction + version-conditioned update) is necessary, not either alone:** the MongoDB transaction by itself guarantees that *all the writes within one call to `/assign`* are atomic (all-or-nothing) and that reads within the transaction see a consistent snapshot — but it does **not**, by itself, prevent two *separate, concurrent* `/assign` calls (each in their own transaction/session) from both reading the same user's stale workload before either commits. This is exactly Part A's scenario. The version-conditioned `findOneAndUpdate` is what turns "both transactions think they can proceed" into "only one of them actually successfully writes" — the second one's conditional update simply matches nothing and is forced to retry with fresh data. **This is the single most important technical explanation to get right in the README and Loom video for the MERN version, and it deserves more explicit narration than the original Postgres version needed, precisely because it's less textbook-standard than `SELECT ... FOR UPDATE`.**

**"Isolation level" (MongoDB read/write concern) choice:** `readConcern: 'snapshot'` inside the transaction + `writeConcern: 'majority'` on commit — the documented, deliberate choice, analogous to picking `REPEATABLE READ`/`SERIALIZABLE` in the original. Named alternative: running without an explicit read concern (defaulting to `local`) — rejected because it risks reading uncommitted-but-in-progress state from a concurrent transaction, undermining the very guarantee this whole mechanism exists to provide.

**Rollback conditions:** task not in `bidding_closed`; no bidder has sufficient capacity; any unexpected error mid-transaction (Mongoose/MongoDB will not auto-rollback the way Postgres does on a thrown error inside a query — the application code must explicitly call `session.abortTransaction()` in a catch block; this is a meaningful, easy-to-forget difference from the original Postgres version and should be called out as such).

**Retry strategy:** required and central to this design (see step 4c) — bounded to a small fixed number of attempts (e.g., 3) with a short backoff between attempts; if all retries are exhausted, return a 503 asking the client to retry, rather than silently returning an incorrect result.

**Concurrency scenario walkthrough (Part A), MongoDB version:** Assign(Task X) and Assign(Task Y) fire near-simultaneously, both resolving User A as the lowest bidder. Both transactions independently read User A's document at roughly the same time, both seeing `capacityVersion: 5`, 10 hours remaining. Whichever transaction's conditional `findOneAndUpdate({ _id: userA, capacityVersion: 5 }, ...)` reaches the database first succeeds, updating workload and bumping the version to 6, and commits. The second transaction's identical conditional update (still filtering on `capacityVersion: 5`) now matches zero documents, since the true current version is 6 — it fails, the second transaction aborts, and the application retries `/assign` for Task Y from scratch, this time reading the fresh `capacityVersion: 6` and the now-reduced remaining capacity, correctly falling through to the next-lowest bidder (or returning 422 if none remain). Exactly one outcome, deterministic based on which conditional update actually lands first, no double-booking.

**Failure recovery:** if the transaction fails for infrastructure reasons (network blip, session timeout), MongoDB's transaction guarantees mean no partial state is persisted as long as `abortTransaction()` is correctly called in the catch path; the task remains safely in `bidding_closed` for a retry — same end guarantee as the original, achieved via explicit application-level abort rather than automatic engine-level rollback.

**Atomic operations summary:** every write inside `/assign` (task status+assignee, winning bid status, losing bids' status, user workload+version, audit documents) happens inside a single MongoDB session/transaction — all-or-nothing, exactly mirroring the original's guarantee, with the version-check layered on top specifically to close the cross-transaction race the transaction alone doesn't close.

---

## PHASE 8 — Database Constraint Strategy (Honesty Table)

| Requirement | "DB-Level" in MongoDB? | Actual Mechanism | App Validation | Reason | Possible Error |
|---|---|---|---|---|---|
| No self-bidding | **No** — application-layer only | Mongoose pre-save hook on `Bid`, looking up the referenced task's `createdBy` | Yes, same hook doubles as this | MongoDB has no cross-document CHECK/trigger equivalent available without Atlas-specific triggers (see note below) | 403 (app) |
| No bid exceeding capacity (bid-time, soft) | **No** — deliberately application-only, same interpretation as original | Service-layer check against `capacity.js` utility | Yes | Same documented interpretation as the original (Phase 4 #3 ambiguity) — advisory only, not meant to be a hard guarantee | 422 (app) |
| Bid cannot be placed after bidding closed | **No** — application-layer only | Mongoose pre-save hook validating the referenced task's current `status` | Yes, same hook | No native cross-document constraint mechanism in vanilla MongoDB | 409 (app) |
| Task cannot move backward in lifecycle | **No** — application-layer only | Mongoose pre-save/pre-update hook comparing old vs. new `status` against a fixed sequence | Yes | Same reasoning — this requires comparing a document's *previous* value to its *proposed new* value, which Mongoose hooks can do but a schema-level validator alone cannot | 409 (app) |
| No two bids from same user on same task | **Yes — true database-engine-level guarantee** | Compound **unique index** `{ task: 1, user: 1 }` | Yes, pre-check for a friendly message, but the index is authoritative | This is the one rule that maps cleanly onto native MongoDB functionality, just like a SQL `UNIQUE` constraint | 409 (mapped from MongoDB error code 11000) |
| Complexity in range 1–5 | **Partially** — Mongoose schema validators run in the application driver layer before the write is sent, not inside the MongoDB engine itself, so this is a meaningfully weaker guarantee than a SQL `CHECK` constraint (which the engine itself enforces regardless of which client/driver writes the data) | Mongoose `min`/`max` schema validator | Yes | Cheap, standard, but bypassable by any write that goes around Mongoose (e.g., a raw driver script, or a future second service writing to the same collection) — worth naming this limitation explicitly in the README | 400 (app) |
| Positive hours offered | Same partial-guarantee caveat as above | Mongoose `min` validator | Yes | Same as above | 400 (app) |
| User capacity cannot go negative post-assignment | **No** — application-only, by design | The version-conditioned transaction in Phase 7 | Yes — this *is* the core business logic | Same as original: this requires comparing a sum against a related document at a specific transactional moment, which is exactly what the Phase 7 algorithm exists to do correctly | 422 (app) if the algorithm is bypassed, which it's designed not to be |

**Honest overall summary, worth stating plainly in the README:** of the five explicitly-required "database-level constraints" from the original assignment, **only one** (no-duplicate-bid) maps onto a true, engine-enforced, non-bypassable MongoDB guarantee. The other four are enforced via Mongoose application-layer hooks/validators, which are real and effective *as long as all writes go through the Mongoose models* — but are not the same category of guarantee as a Postgres `CHECK`/trigger/constraint, which the database engine itself enforces regardless of which application or script is writing to it. **Note on MongoDB Atlas Triggers/Change Streams:** Atlas does offer a true server-side trigger mechanism that could enforce some of these rules closer to the database layer, independent of the writing application — this is worth naming as the closest available "real" equivalent and explaining why it was or wasn't adopted (added infra dependency on Atlas specifically, and a steeper learning curve, for a 48–72 hour assessment).

---

## PHASE 9 — Frontend Architecture

Unchanged from the original in every structural respect (pages, layouts, feature folders, reusable components, forms, dialogs, charts, hooks, contexts, utilities, API layer, error handling, loading) — none of this is backend-technology-dependent. Two substitutions:
- All files are `.jsx`/`.js`, no `.tsx`/`.ts`.
- Types (`Task`, `Bid`, `User`, `DashboardStats`) are documented via **JSDoc comment blocks** (`/** @typedef */`) rather than TypeScript interfaces — gives editors some autocomplete/shape-checking benefit without a compile step, and is the recommended lightweight substitute flagged in the Analysis Blueprint's Phase 11 note.

---

## PHASE 10 — Component Tree

**Identical to the original** — the Task Board, Task Detail, and Dashboard component hierarchies are pure UI/React structure with zero backend-technology dependency. No changes needed; refer to the original tree unchanged.

---

## PHASE 11 — State Management Strategy

**Identical to the original table** (server state in React Query, current user in Context, UI state local, realtime connection state local, forms in React Hook Form) — none of this depends on MongoDB vs. PostgreSQL. The only footnote: the client-side capacity pre-check utility (`capacity.js` on the frontend) must stay in sync with the backend's `capacity.js` — same duplication caveat as the original, now also without TypeScript's compile-time shape-checking to catch drift, making manual discipline (or a shared workspace package) slightly more important here than in the TS version.

---

## PHASE 12 — Realtime Architecture

**Identical to the original in every respect** — connection lifecycle, room joining, broadcast strategy, reconnect strategy, client cache-merge, disconnection handling, and production cold-start considerations are all Socket.IO/Node concerns entirely independent of the database choice. No changes.

---

## PHASE 13 — Validation Strategy (Matrix)

**Identical rules to the original table**, with two substitutions:
- "Server (Zod)" column → "Server (Joi)."
- "DB" column: for the two rows that were true SQL CHECK constraints in the original (complexity range, positive hours), the DB column should now read "Partial — Mongoose validator (app-layer, not engine-enforced)" per the Phase 8 honesty table, rather than a plain "CHECK" — everything else in the matrix (self-bid, duplicate-bid via unique index, bidding-open check, status-transition check) maps the same way as described in Phase 8.

---

## PHASE 14 — Error Handling Architecture

**Structurally identical to the original** (frontend toast/ErrorBoundary, backend typed-domain-error + central middleware, uniform envelope, business-vs-unexpected-error distinction, logging discipline, transactional recovery guarantee) with these MongoDB-specific additions:
- **Database layer:** Mongoose `ValidationError` (schema validator failures) and MongoDB's native duplicate-key error (`code: 11000`) are caught once, at the repository/service boundary, and mapped to the app's typed domain errors — same principle as the original's Postgres-error-code mapping, different specific codes to check for.
- **Realtime layer:** unchanged from original.
- **New category — transaction contention errors:** `TransientTransactionError` and `UnknownTransactionCommitResult` (MongoDB transaction-specific error labels) are caught specifically around the `/assign` transaction, triggering the bounded retry described in Phase 7, and only surfaced to the client as a 503 if retries are exhausted — this error category did not exist in the same form in the Postgres version, where a losing transaction simply waited on a lock rather than needing an explicit catch-and-retry.

---

## PHASE 15 — Security Architecture

**Identical to the original** for input validation, authorization (mocked via header), environment variables, secrets, headers (`helmet`), XSS prevention (React's default escaping), CORS, and the "safe defaults even with mocked auth" principle. One substitution and one addition:
- **"SQL injection prevention" → "NoSQL injection prevention":** parameterized queries have no direct MongoDB equivalent to worry about the same way, but MongoDB has its own injection class — unsanitized user input containing MongoDB query operators (e.g., a JSON body field like `{ "$ne": null }` passed straight into a filter) can distort query logic. **Mitigation:** validate all input strictly via Joi schemas before it reaches any Mongoose query, and add the `express-mongo-sanitize` middleware globally to strip any `$`-prefixed or dot-containing keys from `req.body`/`req.params`/`req.query` as a defense-in-depth layer — this is a new, MongoDB-specific addition to the security architecture with no counterpart in the original Postgres version.
- **File upload security:** unchanged, N/A.

---

## PHASE 16 — Performance Strategy

**Structurally identical goals to the original** (fewer round trips, appropriate indexing, no premature client-side optimization, room-scoped realtime broadcasts) with these substitutions:
- **Indexes:** `bids` compound `{ task, hoursOffered }`, `tasks` single-field `status` and `deadline`, `auditlogs` compound `{ entityType, entityId }`, `users` unique `email` — same index list as the original, expressed as MongoDB indexes instead of SQL indexes.
- **Query optimization → aggregation-pipeline optimization:** the dashboard endpoint's four metrics are the direct analogue of the original's SQL `GROUP BY`/join optimization discussion — recommend running the four aggregation pipelines (status counts via `$group`; avg-bid-per-complexity via `$lookup` + `$group` + `$avg`; top-3-completed via `$match` + `$group` + `$sort` + `$limit`; zero-bid-past-deadline via `$lookup` + `$match` on empty array + deadline comparison) in parallel (`Promise.all`), each backed by the indexes above, rather than forcing all four into a single mega-pipeline — same readability-over-marginal-round-trip-savings justification as the original, and this choice must be explicitly defended in the README exactly as the original spec demanded regardless of which approach is taken.
- **Database optimization:** the version-conditioned update in `/assign` (Phase 7) is scoped to a single targeted document via its `_id` + `capacityVersion` filter, not a broader query — the MERN analogue of "lock only the minimum necessary row" from the original.

---

## PHASE 17 — Testing Blueprint

**Structurally identical scenario list to the original** (status-transition validator, capacity utility boundaries, bid-creation rejections, assignment-engine unit tests, full integration round trips, manual checklist, production smoke tests) implemented with Jest instead of a TS-aware test runner, with two additions specific to the MongoDB conversion:
- **New concurrency test:** simulate two concurrent `/assign` calls competing for the same user's capacity and assert that the version-conditioned update mechanism correctly forces exactly one to succeed and the other to retry-and-fall-through — this is the direct MERN equivalent of the original's Part-A integration test, and arguably even more important to actually demonstrate here given the less-standard locking mechanism (Phase 7).
- **New error-path test:** assert that a duplicate-bid submission correctly surfaces the MongoDB `code: 11000` error as a clean 409, and that a forced transient-transaction error correctly triggers the retry path rather than a raw 500.

---

## PHASE 18 — Git Strategy

**Identical to the original** in branch strategy (trunk-based, short-lived feature branches), commit strategy (small, logically scoped, Conventional Commits style), PR/code-review checklists, and repository organization — entirely stack-independent. One addition to the code-review checklist: **no raw, unsanitized user input passed directly into a Mongoose query filter anywhere** — the MERN-specific analogue of the original's "no raw SQL string concatenation" check.

---

## PHASE 19 — README Blueprint

**Identical section list to the original** (title/overview, live URL, tech stack, env vars, installation, architecture overview, database schema summary, constraints explanation, `/assign` concurrency explanation, Part B/C/D reasoning, realtime justification, API reference, testing, deployment, known limitations, future improvements, Loom link) with these content substitutions:
- **Section 5 (Installation):** must explicitly document the local MongoDB **replica-set initialization step** (not just `docker-compose up` alone, but the one-time `rs.initiate()`-equivalent command needed before transactions will work) — this is a new, easy-to-miss setup requirement that didn't exist in the Postgres version and is worth its own clearly labeled subsection.
- **Section 8 (constraints explanation):** must include the Phase 8 honesty table — which of the five "database-level" rules are true engine-level guarantees (just the one, the unique index) versus application/hook-level (the other four) — stated plainly, not glossed over.
- **Section 9 (`/assign` concurrency explanation):** must explain the transaction + version-conditioned-update mechanism from Phase 7 in full, including the retry-on-conflict behavior, since this is the least "textbook standard" and most scrutiny-worthy part of the whole MERN conversion.
- **New section, recommended right after the overview:** a short, explicit **"Why MongoDB/MERN instead of the originally specified PostgreSQL stack"** note — addressing the deviation head-on rather than leaving a reviewer to wonder or discover it unexplained.

---

## PHASE 20 — Deployment Blueprint

**Structurally identical to the original** (Vercel for frontend, Render for backend, environment variables, CORS, health check endpoint, production verification, rollback plan) with the database section substituted:

**Database deployment (MongoDB Atlas):** provision a free M0 cluster (ships as a 3-node replica set by default, satisfying the transaction requirement without any manual replica-set configuration in production — notably *easier* than the local Docker Compose setup, which requires manual replica-set initialization); whitelist Render's outbound IP (or use Atlas's "allow access from anywhere" for a time-boxed assessment, documented as a deliberate simplification); run `migrate-mongo up` against the Atlas connection string to apply any index migrations, then run the seed script (`node seed.js`) pointed at the same `MONGODB_URI`.

**Realtime deployment:** unchanged from original — Socket.IO/WebSocket considerations on Render are identical regardless of which database sits behind the API.

**Production verification:** add the two new MongoDB-specific smoke tests (duplicate-bid 409 handling, and — if feasible to trigger deliberately — a transaction-retry scenario) to the existing production checklist from the original.

---

## PHASE 21 — Development Timeline (Hour-by-Hour)

**Structurally identical schedule to the original**, with these specific hour-range adjustments to reflect where the stack switch adds or removes friction:

| Hours | Milestone | Change vs. Original |
|---|---|---|
| 0–2 | Project setup: repo, JS configs, Docker Compose | **Slightly longer than original** — replica-set init scripting adds setup time relative to a plain Postgres container |
| 2–4 | Architecture decisions locked, including the MongoDB-deviation write-up | Same duration, added scope (must now also justify the stack choice itself) |
| 4–9 | Mongoose models, indexes, migrate-mongo setup | Comparable duration to the original's SQL migrations, though schema definition itself is typically faster to write than raw SQL — the time saved here is roughly offset by replica-set/transaction setup elsewhere |
| 9–11 | Seed script | Unchanged |
| 11–17 | Core CRUD endpoints | Unchanged |
| 17–27 | **Assignment engine + transaction + version-conditioned retry logic, manually concurrency-tested** | **Longer than the original's 17–25 window** — recommend budgeting 2 extra hours here specifically, since designing and correctly testing the version-conditioned retry mechanism is genuinely more intricate to get right than a single `FOR UPDATE` clause, despite looking similar in scope on paper |
| 27–31 | Dashboard aggregation pipelines | Comparable to original's SQL query design effort |
| 31–34 | Audit logging via Mongoose hooks | Unchanged |
| 34–37 | Backend integration pass + new MongoDB-specific error-path tests | Slightly longer — two new test scenarios added |
| 37–41 | Frontend scaffolding | Unchanged |
| 41–48 | Task Board + Task Detail UI | Unchanged |
| 48–52 | Real-time layer | Unchanged |
| 52–55 | Dashboard UI + chart | Unchanged |
| 55–58 | Full local integration pass | Unchanged |
| 58–60 | README + DECISIONS.md, **including the new stack-deviation and constraint-honesty sections** | Slightly longer — two new required sections |
| 60–63 | Deployment: Atlas, Render, Vercel | Comparable, arguably slightly easier for the DB piece specifically since Atlas's free tier is a replica set by default |
| 63–65 | Production smoke tests including MongoDB-specific scenarios | Slightly longer |
| 65–67 | Loom recording, **proactively addressing the stack deviation** | Same duration, added talking point |
| 67–68 | Final cleanup, submission | Unchanged |

*Net effect: recommend budgeting roughly 2–4 extra hours overall relative to the original SQL-based timeline, concentrated almost entirely in the assignment-engine stage, to account for the genuinely higher intricacy of MongoDB's transaction + optimistic-concurrency pattern relative to a single row lock.*

---

## PHASE 22 — Final Build Order (Granular)

```
Project Setup
 ↓
Repo Structure + Docker Compose (MongoDB single-node replica set) + Env Scaffolding
 ↓
Architecture Decisions Locked (ambiguities resolved + stack-deviation rationale documented)
 ↓
Database
 ↓
Mongoose Model: users (+ capacityVersion field)
 ↓
Mongoose Model: tasks (+ status enum, complexity min/max validators)
 ↓
Mongoose Model: bids (+ compound unique index task+user, compound index task+hoursOffered)
 ↓
Mongoose Model: auditlogs
 ↓
Application-layer guards: self-bid hook, bidding-open hook, forward-only-status hook
 ↓
Seed Script
 ↓
Validation Schemas (Joi, per module)
 ↓
Users Module (repository → service → controller → route: GET /api/users/:id/workload)
 ↓
Tasks Module (repository → service → controller → routes: POST /api/tasks, PATCH /api/tasks/:id/status, GET /api/tasks)
 ↓
Bids Module (repository → service → controller → routes: POST /api/tasks/:id/bids, GET /api/tasks/:id/bids)
 ↓
Audit Module (write-path service, wired into Tasks/Bids services)
 ↓
Assignment Module (transaction + version-conditioned update engine → controller → route: POST /api/tasks/:id/assign)
 ↓
Manual Concurrency Verification of /assign, including forced version-conflict retry test (before moving on)
 ↓
Dashboard Module (aggregation pipelines → service → controller → route: GET /api/dashboard/stats)
 ↓
Backend Integration Pass (manual test of every endpoint + edge case + the two new MongoDB-specific error paths)
 ↓
Frontend Setup (Vite JS scaffold, router, layout, CurrentUserContext, API client)
 ↓
Task Board Page
 ↓
Task Detail Page (BidList, BidForm with capacity pre-check, Advance Status control, Assign button)
 ↓
Realtime (backend Socket.IO server + rooms → frontend socket client + cache-merge hook)
 ↓
Dashboard Page (StatCards, ChartPanel)
 ↓
Full Local Integration Pass
 ↓
Bonus (only if time remains): integration test for the Part A race condition (version-conflict scenario)
 ↓
Bonus (only if time remains): outbid toast notification
 ↓
README + DECISIONS.md (including stack-deviation note and constraint-honesty table)
 ↓
Deployment: MongoDB Atlas → Render backend → Vercel frontend
 ↓
Production migrate-mongo run + Seed + CORS/Env Verification
 ↓
Production Smoke Tests (incl. live concurrency scenario + duplicate-bid + transaction-retry checks)
 ↓
Bonus (only if substantial time remains): bin-packing optimal-assignment endpoint
 ↓
Loom Recording (proactively addressing the stack deviation)
 ↓
Final Repo Cleanup + Link Verification
 ↓
Submission
```

---

## PHASE 23 — Senior Engineering Review (Post-Hoc, as a Staff Engineer)

**What will impress reviewers, given this is a MERN submission against a Postgres-specified assignment:**
- Not hiding the deviation — a proactive, well-reasoned README section explaining why MongoDB was used instead of Postgres, and an honest accounting of which constraints are true database-engine guarantees versus application-layer ones (Phase 8), signals maturity even to a reviewer who'd have preferred the original stack.
- A genuinely demonstrated version-conflict-and-retry mechanism in the `/assign` engine, shown live in the Loom video exactly the way the Postgres version would have shown its row-lock — this is the one place where "does your code actually prevent race conditions or does it just look like it does" (an explicit grading criterion) is just as testable in MongoDB as in Postgres, if done correctly.
- Well-designed aggregation pipelines for the dashboard, with an explicit justification of the parallel-four-pipelines choice, standing in for the original's SQL-proficiency criterion.

**Common implementation mistakes to avoid (MERN-specific):**
- Using a MongoDB transaction *without* the version-conditioned update, believing the transaction alone prevents the Part-A race — it does not, per Phase 7's explicit reasoning, and this is the single most likely place a MERN submission would fail the live concurrency test.
- Forgetting the local replica-set initialization step, causing transactions to silently fail or throw confusing errors for anyone (including a reviewer) trying to run the project locally.
- Treating Mongoose schema validators as equivalent in strength to SQL CHECK constraints without noting the difference — a reviewer who knows both stacks will notice this gap immediately if it's glossed over.
- Embedding bids as a sub-array on the task document (a common MongoDB anti-pattern for this kind of frequently-written, independently-queried child entity) rather than referencing them as their own collection (Phase 9 of the Analysis Blueprint's data-model reasoning).

**Architecture smells to avoid:** same list as the original (logic leaking out of its layer, scattered raw queries instead of organized repositories, monolithic files, unrequested infrastructure) — entirely stack-independent smells.

**Things to prioritize, in order, adjusted for this stack:** (1) honest, well-designed schema + the one true unique-index constraint + clearly-documented application-layer constraint emulation for the rest, (2) the transaction + version-conditioned-retry assignment engine, demonstrably tested live, (3) well-justified aggregation pipelines for the dashboard, (4) consistent error handling including the new MongoDB-specific error categories, (5) README trade-off articulation **including the stack-deviation rationale**, (6) code organization, (7) a genuinely working, seeded, real-time production deployment on Atlas/Render/Vercel.

**Potential rejection reasons, MERN-specific addition:** beyond the original list (broken deployment, missing Loom, failed concurrency test, non-functioning constraints, forbidden-ORM use), a MERN submission carries one **additional** rejection risk not present in the original: a reviewer strictly enforcing the assignment's explicit "PostgreSQL, raw SQL, no ORM" instructions may reject the submission on stack-choice grounds alone, regardless of implementation quality — this is why Phase 5's clarification question about stack acceptability should ideally be resolved *before*, not after, the full 48–72 hour investment.

**How to maximize the assessment score given this stack:** treat Phase 7 (the transaction + version-conditioned-retry mechanism) as the single highest-leverage section of the entire build, since it's the one place a MERN implementation can most convincingly demonstrate the exact same engineering judgment the original assignment's top-ranked criteria are testing for — and treat the README's honesty about constraint-guarantee strength (Phase 8) as equally important evidence of engineering maturity, since glossing over that gap would read worse to a senior reviewer than transparently naming it.
