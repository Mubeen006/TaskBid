# Feature 06 — Tasks Module

**Status:** TESTED — READY FOR COMMIT
**Depends on:** Feature 02 (Database Schema), Feature 04 (Validation Schemas) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 5 (API Contract), Phase 6 (Backend Module Design), Analysis Blueprint Phase 7/8 (user flows, edge cases for status transitions)

---

## Goal

Three endpoints: create a task, advance a task's status, and list tasks (an inferred addition — not in the original assignment's literal endpoint table, but required by the Task Board view, and already flagged as such in the Architecture Blueprint Phase 5). This is the first module to actually exercise the forward-only-status guard hook from Feature 02 through a real HTTP path, so pay close attention to the status-transition endpoint's correctness.

## Scope (this feature ONLY)

- `backend/src/modules/tasks/tasks.repository.js`, `tasks.service.js`, `tasks.controller.js`.
- Mounting under `/api/tasks` in `app.js`, following the Router-per-module pattern established in Feature 05.

## Explicitly OUT of scope for this feature
- No bid-related logic at all — that's Feature 07, even though bids are conceptually tied to tasks.
- No assignment logic — that's Feature 09.
- No audit log writes yet — Feature 08 doesn't exist yet at this point in the build order. **Do not skip this permanently** — once Feature 08 exists, come back and wire audit calls into this module's mutating operations (create, status change). Note this explicitly in your report so it isn't forgotten (see Report Back section).
- No `GET /api/tasks/:id` single-task-detail endpoint unless you determine the frontend's Task Detail page (Feature 14) will need it distinctly from the list endpoint — if so, flag this as a scope question rather than silently adding or omitting it (see `MASTER_PROMPT.md`'s BLOCKED format if genuinely ambiguous; otherwise a single-task GET is a reasonable, low-risk inferred addition similar to the list endpoint, and you may add it with a one-line justification in your report).

---

## Endpoint Specifications

### `POST /api/tasks`
- Middleware: `currentUser` (Feature 04) — `createdBy` is derived from `req.currentUser`, **never** trusted from the request body. Then `validate(createTaskSchema, 'body')` (Feature 04).
- Service: create the task via `Task.create({ ...validatedBody, createdBy: req.currentUser._id, status: 'draft' })` — status is always `'draft'` on creation, not client-supplied.
- Response: 201, the created task.
- Errors: 400 (validation, from Feature 04's schema — no new validation logic needed here).

### `PATCH /api/tasks/:id/status`
- Middleware: `currentUser`, `validate(updateStatusSchema, 'body')` (shape-only: is `targetStatus` one of the seven valid enum values), `validate(taskIdParamSchema, 'params')`.
- Service, in this exact order:
  1. Fetch the task by id (`Task.findById`). If not found, throw `NotFoundError`.
  2. Check whether `targetStatus` is the **legal next status** from the task's current status — this is the business-rule check Feature 04's schema deliberately did NOT do (shape vs. legality is a distinct concern, per Feature 04's own scope notes). Use `isLegalForwardTransition` from `utils/statusSequence.js` (already built in Feature 02). If illegal, throw `ConflictError('Cannot move task status from "X" to "Y"')` — **note:** the Mongoose guard hook in Feature 02 will also reject this at the model layer if you get this service-level check wrong or skip it, but relying on the guard hook alone here would mean the caller gets a generic Mongoose validation error instead of a clean, specific `ConflictError` — do this check explicitly in the service for a good error message, don't just let the guard hook be the only line of defense.
  3. Apply the change via `task.setStatus(targetStatus); await task.save();` — **never** `Task.findByIdAndUpdate()` for this, per the binding rule from Feature 02/`PROJECT_OVERVIEW.md` section 5.
- Response: 200, the updated task.
- Errors: 404 (task not found), 400 (invalid enum value, from Feature 04's schema), 409 (legal-enum-value-but-illegal-transition, from the service-level check above).

### `GET /api/tasks`
- No `currentUser` requirement (read-only, matches the workload endpoint's precedent from Feature 05).
- Should support the Task Board's needs: return tasks with enough info to render title/complexity/deadline/status, **plus bid count and lowest-bid-hours per task** (per the Analysis Blueprint's Task Board requirements). Since the Bids module doesn't exist yet (Feature 07), you have two options — pick one and state which in your report:
  - **(a)** Build this endpoint now returning tasks only (no bid aggregation), and note clearly in your report and in `TRACKING.md` that bid-count/lowest-bid fields are a **known gap to close once Feature 07 exists** — this keeps this feature's scope clean and avoids reaching into a collection whose module isn't built yet.
  - **(b)** Build it now including a `$lookup`-style aggregation against the `bids` collection directly (bypassing the not-yet-built Bids module, querying the collection MongoDB-natively since the schema already exists from Feature 02), accepting that this creates a small cross-module dependency now instead of later.
  - **Recommendation: option (a).** Keep this feature's scope to tasks only; revisit and extend this endpoint once Feature 07 is done, since the Bids module owns bid-related querying logic and this endpoint reaching into `bids` directly ahead of that module being built risks duplicating logic Feature 07 will also need. Flag the revisit explicitly so it isn't forgotten (see Report Back).
- Response: 200, array of tasks (optionally filterable by `?status=` query param — reasonable, low-risk addition if you have time, not required).

---

## Acceptance Criteria

- [ ] `POST /api/tasks` creates a task with `status: 'draft'` regardless of any `status` field sent in the request body (confirm the client cannot override this).
- [ ] `POST /api/tasks` uses `req.currentUser._id` for `createdBy`, ignoring any `createdBy` sent in the body.
- [ ] `PATCH /api/tasks/:id/status` with a legal next status (e.g., `draft` → `open`) succeeds, 200.
- [ ] `PATCH /api/tasks/:id/status` with an illegal transition (backward, e.g., `open` → `draft`, or skip-ahead, e.g., `draft` → `bidding_closed`) is rejected with a 409 and a clear message — confirm this is caught by your **service-level** check, not just falling through to a raw Mongoose/guard-hook error.
- [ ] `PATCH /api/tasks/:id/status` with a `targetStatus` value not in the enum at all is rejected with 400 by Feature 04's schema validation, before your service code even runs.
- [ ] `GET /api/tasks` returns all seeded tasks with correct shape.
- [ ] Status changes in this module go through `task.setStatus()` + `.save()` exclusively — no `findByIdAndUpdate`/`updateOne` used for status anywhere in this feature's code.

## Self-Test Checklist (do this before reporting ready)

1. Run through every legal single-step transition in the sequence once (`draft→open→bidding_closed→assigned→in_progress→review→done`) against a fresh test task, confirming each succeeds.
2. Attempt at least one backward transition and one skip-ahead transition against a seeded task, confirming both are rejected with 409 and the correct message.
3. Attempt to create a task while sending a `status` and `createdBy` field in the body that don't match reality (e.g., `status: 'done'`, `createdBy: <some other user's id>`) and confirm both are ignored/overridden correctly.
4. Confirm `GET /api/tasks` reflects the current seeded state accurately.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly list:
- Which option ((a) or (b)) you took for `GET /api/tasks`'s bid-info gap, and confirm it's logged as a follow-up item for Feature 07 if you took option (a).
- Whether you added a `GET /api/tasks/:id` single-task endpoint, and a one-line justification either way.
- Confirmation that the audit-log wiring gap (no audit calls yet, since Feature 08 doesn't exist) is noted as a follow-up, so it isn't silently forgotten once Feature 08 is built.
