# Feature 08 — Audit Log Module

**Status:** NOT STARTED
**Depends on:** Feature 02 (Database Schema — `auditlog.model.js` already exists), Feature 06 (Tasks Module), Feature 07 (Bids Module) must all be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 6 (audit as a single write-path service, called by other services), Analysis Blueprint Part D (audit log design reasoning), Architecture Blueprint Phase 4 (`auditlogs` schema — field-level rows, not full-snapshot JSON)

---

## Goal

One centralized service that every mutating operation calls to record a change, then **retrofit it into Features 06 and 07**, which were deliberately built without audit calls (a documented, tracked gap in both their `TRACKING.md` rows). This feature both builds the audit service and closes those two follow-ups — it does not just add new code, it goes back and wires existing code.

## Scope (this feature ONLY)

- `backend/src/modules/audit/audit.service.js`, `audit.repository.js` (the model, `auditlog.model.js`, already exists from Feature 02 — don't recreate it, just build the repository/service around it).
- **Retrofit calls into:**
  - `tasks.service.js` — after successful task creation, and after successful status change.
  - `bids.service.js` — after successful bid creation.
- No new HTTP endpoints in this feature — the audit log is written to, never read from via the API (no `GET /api/audit` endpoint exists or is needed per the original assignment or either blueprint).

## Explicitly OUT of scope for this feature
- No wiring into Feature 09 (Assignment Engine) yet — it doesn't exist. Feature 09's own MD will specify exactly where inside its transaction the audit write belongs (this matters a lot there, since it must happen inside the same transaction as the rest of the assignment — don't try to anticipate that logic here, just build the generic service Feature 09 will call into).
- No audit-log *read* endpoint, no audit-log filtering/pagination — not required by any part of the assignment brief.
- No changes to the `auditlogs` schema itself — it's already correct from Feature 02.

---

## `audit.service.js` Specification

Export one function, something like:

```
recordChange({ entityType, entityId, actorUserId, fieldChanged, oldValue, newValue })
```

- `entityType`: `'task'` or `'bid'`.
- `entityId`: the ObjectId of the task/bid that changed.
- `actorUserId`: the user who caused the change — from `req.currentUser._id` in the calling service. Nullable only if truly no actor exists (shouldn't happen in practice once `currentUser` middleware is required on every mutating route, per Feature 04).
- `fieldChanged`: `null` for a full-document creation event, or the specific field name (e.g., `'status'`) for an update.
- `oldValue`/`newValue`: for creation events, `oldValue: null` and `newValue` can be a small relevant snapshot (not the entire document — just enough to be useful, e.g., for task creation: `{ title, status: 'draft' }`; for bid creation: `{ hoursOffered, status: 'pending' }`). For a status change, `oldValue`/`newValue` are simply the previous/next status strings.
- Internally: calls `audit.repository.js`'s `create()`, which just wraps `AuditLog.create(...)`.

**Failure handling — a deliberate design decision, not an oversight:** the audit write happens **after** the primary operation (task/bid save) has already succeeded and is not wrapped in the same transaction as that primary operation, because Features 06/07 don't use transactions at all (only Feature 09's assignment engine does). This means: if the audit write itself fails for some infrastructure reason, **the primary operation must not be rolled back or fail** — log the audit-write failure server-side (via the logger) and let the response to the client proceed as normal. An audit-log gap is a lesser problem than losing a successfully-completed task/bid write because of an unrelated audit-log hiccup. State this explicitly in your report so it's clear this is deliberate, not a bug you're planning to fix later.

## Retrofit Points

**`tasks.service.js`:**
- After `Task.create(...)` succeeds: `recordChange({ entityType: 'task', entityId: task._id, actorUserId: req.currentUser._id, fieldChanged: null, oldValue: null, newValue: { title: task.title, status: task.status } })`.
- After the status-transition service logic succeeds (i.e., after `task.setStatus(target); await task.save();` both complete without error): `recordChange({ entityType: 'task', entityId: task._id, actorUserId: req.currentUser._id, fieldChanged: 'status', oldValue: previousStatus, newValue: target })` — you'll need to capture `previousStatus` before calling `setStatus()`, since that method mutates `this.status` (via `_previousStatus` internally, but that's Feature 02's internal bookkeeping for the guard hook, not something the service layer should reach into — capture your own local variable for the audit call).

**`bids.service.js`:**
- After a bid is successfully created: `recordChange({ entityType: 'bid', entityId: bid._id, actorUserId: req.currentUser._id, fieldChanged: null, oldValue: null, newValue: { hoursOffered: bid.hoursOffered, status: bid.status } })`.

---

## Acceptance Criteria

- [ ] `audit.service.js`'s `recordChange` function exists and matches the shape above.
- [ ] Creating a task via `POST /api/tasks` produces exactly one new `auditlogs` document with `entityType: 'task'`, `fieldChanged: null`.
- [ ] Advancing a task's status via `PATCH /api/tasks/:id/status` produces exactly one new `auditlogs` document with `entityType: 'task'`, `fieldChanged: 'status'`, correct `oldValue`/`newValue`.
- [ ] Creating a bid via `POST /api/tasks/:id/bids` produces exactly one new `auditlogs` document with `entityType: 'bid'`, `fieldChanged: null`.
- [ ] A rejected task/bid mutation (e.g., an illegal status transition, a duplicate bid) produces **no** audit log entry — audit only records successful changes, never failed attempts.
- [ ] Manually simulating an audit-write failure (e.g., temporarily point the audit repository at a bad collection name, or otherwise force an error inside `recordChange`) confirms the primary task/bid operation still succeeds and the client still gets a normal success response — the audit failure is logged but does not propagate as an error to the caller.

## Self-Test Checklist (do this before reporting ready)

1. Create a task, advance its status once, and create a bid on a different open task — then query `auditlogs` directly (via `mongosh` or a throwaway script) and confirm exactly three new entries exist, each with the correct shape.
2. Attempt one rejected mutation of each type (illegal status transition, duplicate bid) and confirm no corresponding audit entries were created for those failed attempts.
3. Force an audit-write failure as described in the last acceptance criterion above and confirm the primary operation's response to the client is unaffected — this is the one test in this whole feature that's easy to skip and shouldn't be.
4. Confirm ESLint clean, no `.ts` files.

---

## ⚠️ ADDENDUM — Supersedes the "Failure Handling" Section Above (Correction, Not New Scope)

**This corrects a genuine inconsistency with an already-approved decision**, not a new requirement invented after the fact: Architecture Blueprint Phase 7 ("Transaction Architecture") already stated that `PATCH /tasks/:id/status` and `POST /tasks/:id/bids` must each be atomic with their audit-log write, wrapped in a single MongoDB session/transaction. The original version of this feature's "Failure Handling" section above contradicted that and must not be followed. **`POST /api/tasks` (plain task creation) is NOT included in this correction** — Phase 7 never listed it, a single-document insert is already atomic on its own, and its audit write may remain sequential/non-transactional exactly as originally specified above.

**What changes:**

- `audit.repository.js`'s create function must accept an optional `session` and pass it through to `AuditLog.create([payload], { session })` — note Mongoose requires the array-argument form of `.create()` for the `session` option to take effect.
- `audit.service.js`'s `recordChange()` must accept and forward an optional `session` parameter (add it as an optional final argument, don't break the Feature 08-original call sites that don't need one — i.e., task creation can still call it with no session).
- **`tasks.service.js`'s status-transition method** must: start a session (`mongoose.startSession()`), `session.startTransaction()`, fetch the task within the session, `task.setStatus(target)`, `await task.save({ session })`, call `recordChange({ ...args, session })`, `await session.commitTransaction()`. On any error at any step: `await session.abortTransaction()`, then rethrow so the controller's error handling still applies. Always `session.endSession()` in a `finally`.
- **`bids.service.js`'s bid-creation method** must follow the same session lifecycle: start transaction, `await Bid.create([bidData], { session })` (array form, required to pass session through `create`), `recordChange({ ...args, session })`, commit; abort-and-rethrow on any error; `endSession()` in `finally`.
- **This also closes the previously-accepted "known gap" logged in `TRACKING.md`** about the Bid `pre('findOneAndUpdate')`/`pre('save')` guard's `runSelfBidAndOpenCheck()` using a hardcoded `session: null`. That gap was explicitly accepted *because* bid creation wasn't expected to run inside a real transaction as normal operation — it now does, per this addendum. **The guard hook's Task lookup inside `bids.model.js` must now actually receive and use the active session** (it already has the plumbing for this via `this.$session()` in the `save` hook per the original Feature 02 work — confirm it's actually being passed through end-to-end now that bid creation runs inside a transaction for real, not just defensively).

**Corrected atomicity test (replaces the old "audit failure ≠ primary failure" test for these two paths only):** force an error to occur *after* the primary document's `.save()`/`.create()` inside the transaction but *before* `commitTransaction()` (e.g., temporarily make `recordChange` throw) and confirm **the primary task/bid document is also rolled back** — query the database directly afterward and confirm no orphan task-status-change or orphan bid document exists. This is the real proof of atomicity: previously "the primary operation survives an audit failure" was the target; now the correct target is "both roll back together, or both succeed together, with no in-between state." The original task-creation path (non-transactional, per this addendum's scope) keeps its original test — an audit failure there should NOT roll back the already-created task, since Phase 7 never required that path to be atomic.



## Report Back (Addendum: also report on the transactional retrofit)

In addition to the items below, explicitly confirm: task creation remains non-transactional (per this addendum's stated scope, this is correct, not a gap); status-transition and bid-creation are now genuinely transactional with the rollback test actually run and passed; and the Bid guard hook's session-passing gap (previously an accepted known gap in `TRACKING.md`) has been closed, with the exact line/location stated.

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm:
- All three retrofit points (task creation, task status change, bid creation) are wired and each produces exactly one audit entry, not zero and not duplicates.
- The failure-isolation behavior (audit failure ≠ primary operation failure) was actually tested, not just assumed to work because the code "looks like" it should.
