# Feature 02 — Database Schema (Mongoose Models)

**Status:** NOT STARTED
**Depends on:** Feature 01 (Project Setup) must be READY FOR TEST or COMMITTED before starting this.
**Blueprint references:** Architecture Blueprint Phase 4 (Database Blueprint), Phase 8 (Database Constraint Strategy — honesty table), Phase 3 (folder structure for `modules/*/[entity].model.js`)

---

## Goal

Define all four Mongoose models (`users`, `tasks`, `bids`, `auditlogs`) with correct fields, validators, defaults, and indexes — exactly as specified in the Architecture Blueprint's Phase 4 tables. No business logic, no routes, no services yet — schema only, plus the application-layer guard hooks that stand in for the "database-level constraints" that MongoDB can't enforce natively (per Phase 8).

## Scope (this feature ONLY)

- Four Mongoose schema/model files.
- Indexes as specified (including the one true database-engine-level constraint: the compound unique index on `bids`).
- Three Mongoose pre-save/pre-update guard hooks (self-bid, bidding-closed, forward-only-status) — schema-adjacent, defined here since they live directly on the model files, but must NOT contain business-rule logic beyond the specific checks named below.
- `migrate-mongo` setup, with the index-creation steps captured as numbered migration files (per Architecture Blueprint Phase 2 and Phase 19's installation-section requirement).

## Explicitly OUT of scope for this feature
- No services, controllers, or repositories yet (Features 05–10).
- No seed data (Feature 03).
- No Joi validation schemas (Feature 04) — that's request-shape validation, different from these Mongoose schema-level validators.
- No assignment-engine transaction/version-conflict logic (Feature 09) — the `capacityVersion` field is defined here, but the conditional-update logic that uses it is Feature 09's job.

---

## Model Specifications

### `users` (`backend/src/modules/users/users.model.js`)

| Field | Type | Required | Default | Validator |
|---|---|---|---|---|
| name | String | yes | — | — |
| email | String | yes | — | unique index |
| hourlyRate | Number | yes | — | `min: 0` |
| maxCapacityHours | Number | yes | — | `min: 0` |
| currentWorkloadHours | Number | no | `0` | `min: 0` |
| capacityVersion | Number | no | `0` | — |

`timestamps: true` (gives `createdAt`/`updatedAt` automatically).

### `tasks` (`backend/src/modules/tasks/tasks.model.js`)

| Field | Type | Required | Default | Validator |
|---|---|---|---|---|
| title | String | yes | — | `maxlength: 200` |
| description | String | no | `null` | — |
| complexity | Number | yes | — | `min: 1, max: 5` |
| status | String | no | `'draft'` | `enum: ['draft','open','bidding_closed','assigned','in_progress','review','done']` |
| createdBy | ObjectId (ref: 'User') | yes | — | — |
| assignedUser | ObjectId (ref: 'User') | no | `null` | — |
| assignedBid | ObjectId (ref: 'Bid') | no | `null` | — |
| deadline | Date | yes | — | — |

`timestamps: true`.
**Indexes:** single-field on `status`, single-field on `deadline`.

**Guard hook (pre-save/pre-`findOneAndUpdate`):** when `status` is being changed on an existing document, validate the transition is exactly the next value in this fixed sequence — `draft → open → bidding_closed → assigned → in_progress → review → done`. Reject (throw a validation-style error) any backward move or any skip-ahead move. This hook enforces the "task cannot move backward" rule from Phase 8 — note in your code's error message (not a comment, an actual thrown error message) that this is an application-layer guard, consistent with the Phase 8 honesty table.

### `bids` (`backend/src/modules/bids/bids.model.js`)

| Field | Type | Required | Default | Validator |
|---|---|---|---|---|
| task | ObjectId (ref: 'Task') | yes | — | — |
| user | ObjectId (ref: 'User') | yes | — | — |
| hoursOffered | Number | yes | — | `min: 0.01` |
| status | String | no | `'pending'` | `enum: ['pending','assigned','not_selected']` |

`timestamps: { createdAt: true, updatedAt: false }` (bids don't need an updatedAt per the blueprint's field list).

**Indexes:**
- Compound **unique** index: `{ task: 1, user: 1 }` — this is the one true database-engine-level constraint (no two bids from the same user on the same task). Must be declared with `unique: true` at the schema-index level, not just a code-level pre-check.
- Compound index: `{ task: 1, hoursOffered: 1 }` — supports sorted retrieval and the assignment engine's ordered scan.

**Guard hook (pre-save):**
- Self-bid check: look up the referenced `task`'s `createdBy`; if it equals `this.user`, reject with a clear error ("You cannot bid on your own task").
- Bidding-open check: look up the referenced `task`'s `status`; if it is not `'open'`, reject with a clear error ("Bidding is closed for this task").

Both checks require an extra lookup of the parent `Task` document inside the hook — do this via `this.model('Task').findById(this.task)` (or the equivalent), and make sure the hook works correctly whether or not it's running inside a session/transaction (accept and pass through a session if one is active — this matters later when bids are created inside transactional contexts).

**⚠️ Decision made during implementation review — applies to ALL THREE guard hooks in this feature (self-bid, bidding-open, forward-only-status):**

`pre('save')` hooks only fire on `.save()`. They do **not** fire on `.updateOne()`, `.findOneAndUpdate()`, `.updateMany()`, or raw `.collection.insertMany()`/`.insertOne()` calls — meaning any service, script, or future developer using those methods silently bypasses every guard in this feature with no error at all. This was discovered as a real bug during the seed script's implementation (Feature 03), where the coding agent needed to attach a bid to an already-`assigned`/`done` task for historical seed data and, blocked by the `pre('save')` guard, fell back to raw driver calls — which also silently skipped Mongoose's own field validators (`min`, `enum`, `required`) on those documents, not just the guard.

**Required fix:** duplicate each of the three guard checks as `pre('findOneAndUpdate')` **query middleware** as well as the existing `pre('save')` **document middleware**, so the same rule is enforced regardless of which method a caller uses to write. This is more defensive than relying on "always use fetch-then-save" discipline alone (which the assignment-engine design in Feature 09 already deviates from anyway, since query-level conditional updates are the whole point of the optimistic-concurrency mechanism there).

- For `pre('findOneAndUpdate')` on `Task`: inspect `this.getUpdate()` for a `status` change; if present, you need the document's *current* status to validate the transition — use `this.getQuery()` + a `findOne` read inside the hook (via `this.model.findOne(this.getQuery())`) to fetch the pre-update state, then apply the same `isLegalForwardTransition` check used in the `save` hook.
- For `pre('findOneAndUpdate')` on `Bid`: same self-bid/bidding-open checks, but only relevant if the update is inserting new self-bid-relevant fields (in practice, bids are created via `save`/`create`, not updated later — so this query-middleware guard on `Bid` is a defensive backstop for correctness/consistency, not something expected to trigger often; still implement it for the same "no silent bypass" reason).
- Raw `.collection.insertMany()`/`.insertOne()` calls bypass Mongoose entirely (schema validators included) and must not be used anywhere in this codebase, in any feature, for documents that need any of these guarantees — including in the seed script (see Feature 03's corrected instructions). If you find yourself reaching for a raw driver call to get around a guard, that is the signal to fix the guard's coverage (as done here), not to route around it.

### `auditlogs` (`backend/src/modules/audit/auditlog.model.js`)

| Field | Type | Required | Default |
|---|---|---|---|
| entityType | String | yes | — (`enum: ['task','bid']`) |
| entityId | ObjectId | yes | — |
| actorUserId | ObjectId (ref: 'User') | no | `null` |
| fieldChanged | String | no | `null` |
| oldValue | Mixed (`Schema.Types.Mixed`) | no | `null` |
| newValue | Mixed | no | `null` |
| changedAt | Date | no | `Date.now` |

**Indexes:** compound `{ entityType: 1, entityId: 1 }`.
No guard hooks needed — this collection is write-only from the app's own audit-service layer (Feature 08), not user input.

---

## Migrations (`migrate-mongo`)

Set up `migrate-mongo` in `backend/src/db/migrations/`. Capture the index creation (not the schema shape itself, which lives in the Mongoose model files) as numbered migration files, e.g.:
- `001-users-email-unique-index.js`
- `002-bids-compound-indexes.js`
- `003-tasks-status-deadline-indexes.js`
- `004-auditlogs-entity-index.js`

Each migration should be idempotent (safe to run against a DB that may already have the index) and reversible (a working `down` function that drops the index).

---

## Acceptance Criteria

- [ ] All four models exist with fields/validators/defaults exactly matching the tables above.
- [ ] `migrate-mongo up` run against the local replica set successfully creates every index listed above — verify via `mongosh` → `db.<collection>.getIndexes()`.
- [ ] Attempting to insert a second bid with the same `{task, user}` pair throws a MongoDB duplicate-key error (code `11000`) — confirm this manually (a throwaway script or `mongosh` insert is fine for this feature; a formal automated test isn't required until Feature 17, but you must prove it works now).
- [ ] Attempting to save a `Bid` where `user` equals the referenced task's `createdBy` is rejected by the guard hook.
- [ ] Attempting to save a `Bid` on a task whose `status` is not `'open'` is rejected by the guard hook.
- [ ] Attempting to update a `Task`'s status backward (e.g., `assigned` → `open`) is rejected by the guard hook; a valid forward move (e.g., `draft` → `open`) succeeds.
- [ ] **NEW:** Attempting to move a `Task` backward via `Task.findOneAndUpdate({ _id }, { status: 'open' })` (not `.save()`) is ALSO rejected — the query-middleware guard fires, not just the document-middleware guard.
- [ ] No business logic beyond the specific guards named above lives in these model files — no capacity math, no assignment logic (that's Feature 09).

## Self-Test Checklist (do this before reporting ready)

1. Write and run a disposable manual test script (not a permanent test file — Feature 17 owns formal tests) that: creates two users, one task, one bid, then attempts each of the four rejection scenarios above and confirms each one throws.
2. Confirm `migrate-mongo status` shows all migrations applied cleanly on a fresh replica-set instance (tear down and rebuild the Docker volume to confirm this isn't relying on leftover state from earlier manual testing).
3. Confirm no `.ts` files were introduced and ESLint still runs clean.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly list which of the five Phase-8 "constraint" rules are now enforced and confirm which one (only one — the duplicate-bid unique index) is a true database-engine-level guarantee versus the three that are application-hook-level (self-bid, bidding-closed, forward-only-status) — this distinction must be stated accurately now so it flows correctly into the README later (Feature 18).
