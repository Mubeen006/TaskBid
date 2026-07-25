# Feature 07 — Bids Module

**Status:** TESTED — READY FOR COMMIT
**Depends on:** Feature 02 (Database Schema), Feature 04 (Validation Schemas), Feature 05 (Users Module — `capacity.js`) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 5 (API Contract), Phase 6 (Backend Module Design), Phase 8 (constraint-honesty table — bid-time capacity is deliberately soft), Analysis Blueprint Part B (stale bid reasoning)

---

## Goal

Bid placement and bid-listing, plus closing a gap deliberately left open by Feature 06: `GET /api/tasks` doesn't yet return bid count / lowest-bid-hours per task, because the Bids module didn't exist when Feature 06 was built. This feature both builds bids and closes that gap.

## Scope (this feature ONLY)

- `backend/src/modules/bids/bids.repository.js`, `bids.service.js`, `bids.controller.js`.
- Mounting under `/api/tasks/:id/bids` in `app.js` (nested under tasks, matching the API contract's URL shape), following the Router pattern from Features 05/06.
- **Revisit `backend/src/modules/tasks/tasks.repository.js` / `tasks.service.js`** to add bid-count and lowest-bid-hours to the `GET /api/tasks` response — this was Feature 06's documented follow-up (option (a) in its MD). Read Feature 06's `TRACKING.md` entry first to see exactly which option was taken and what was deferred before touching this.

## Explicitly OUT of scope for this feature
- No assignment logic — that's Feature 09. This feature never changes a task's status, never sets `assignedUser`/`assignedBid`.
- No audit log writes yet, same deferred-until-Feature-08 situation as Feature 06 — note it as a follow-up again, don't silently skip noting it.
- No hardening of the bid-time capacity check into a hard/authoritative check. It stays soft/advisory by design (see below) — this is not a gap to "fix," it's the documented Part B interpretation.

---

## Endpoint Specifications

### `POST /api/tasks/:id/bids`
- Middleware: `currentUser` (Feature 04), `validate(createBidSchema, 'body')` (Feature 04 — shape only: `hoursOffered > 0`), `validate(bidTaskIdParamSchema, 'params')`.
- Service, in this order:
  1. Fetch the task by id. If not found, throw `NotFoundError`.
  2. **Soft capacity check:** fetch `req.currentUser` (already available from the `currentUser` middleware — no need to re-fetch) and call `hasCapacityFor(req.currentUser, validatedBody.hoursOffered)` from Feature 05's `capacity.js`. If `false`, throw `UnprocessableError('This exceeds your remaining capacity')`. **This check is deliberately soft/advisory** — it reflects the bidder's capacity *right now*, at bid time, and is explicitly allowed to become stale by the time assignment happens (Part B). Do not attempt to reserve or lock capacity here, and do not treat this check as authoritative — Feature 09's assignment-time check is the only authoritative one. If you find yourself wanting to make this check "more correct" by adding locking/transactions here, stop — that would contradict the documented design.
  3. Attempt `Bid.create({ task: taskId, user: req.currentUser._id, hoursOffered: validatedBody.hoursOffered })`. Let the Feature 02 guard hooks (self-bid, bidding-open) and the unique index do their job — do not duplicate their checks redundantly in this service beyond what's needed for a clean error message (see next point).
  4. Catch and translate: a Mongoose guard-hook rejection (self-bid or bidding-closed) should surface as the specific `ForbiddenError`/`ConflictError` message the guard hook already produces — don't swallow it into a generic 500. A MongoDB duplicate-key error (code `11000`, from the unique index) must be caught and translated to `ConflictError('You have already placed a bid on this task')` — this is the specific error-mapping requirement flagged back in the Analysis Blueprint's edge cases (Phase 8) and Architecture Blueprint Phase 14.
- Response: 201, the created bid.
- Errors: 404 (task not found), 400 (validation), 403 (self-bid, from the guard hook), 409 (bidding closed, or duplicate bid), 422 (soft capacity check failed).

### `GET /api/tasks/:id/bids`
- No `currentUser` requirement (read-only).
- Returns all bids for the task, **sorted ascending by `hoursOffered`** (per the original assignment's explicit requirement) — use the `{ task, hoursOffered }` compound index from Feature 02, don't sort in application code after an unsorted fetch.
- Errors: 404 if the task doesn't exist.

### `GET /api/tasks` — extending Feature 06's endpoint
- Add `bidCount` and `lowestBidHours` (null if no bids) to each task in the response.
- Implementation approach: either a `$lookup`-based aggregation in `tasks.repository.js` against the `bids` collection, or a per-task query from `bids.repository.js` called by `tasks.service.js` — pick whichever keeps the module boundary cleanest (recommend: `bids.repository.js` exposes a `getBidSummaryForTasks(taskIds)` function returning a map of `taskId → { count, lowestHours }` in one query using `$in`, and `tasks.service.js` calls into it and merges the result — this avoids `tasks.repository.js` needing to know about the `bids` collection's shape directly, keeping the "each module owns its own collection's query logic" principle from the Architecture Blueprint intact).

---

## Acceptance Criteria

- [ ] `POST /api/tasks/:id/bids` succeeds for a valid bid on an open task by a user who isn't the creator and has capacity.
- [ ] Self-bid attempt is rejected (403), surfaced from the Feature 02 guard hook's message, not a generic error.
- [ ] Bid on a non-`open` task is rejected (409), surfaced from the guard hook's message.
- [ ] Duplicate bid (same user, same task) is rejected (409) with the specific "already placed a bid" message — confirm this is the MongoDB code-`11000` path being caught and translated, not an unhandled 500.
- [ ] Bid exceeding the bidder's current remaining capacity is rejected (422) via the soft check — but **only checked against current capacity at the moment of the bid**, never against any hypothetical future state.
- [ ] `GET /api/tasks/:id/bids` returns bids sorted ascending by `hoursOffered`.
- [ ] `GET /api/tasks` now includes `bidCount`/`lowestBidHours` per task, correct against seeded data (e.g., the "Build reporting dashboard" task should show `bidCount: 3`, `lowestBidHours: 4`).
- [ ] No status/assignment mutation of any kind occurs anywhere in this feature's code.

## Self-Test Checklist (do this before reporting ready)

1. Place a valid bid on the seeded "Migrate legacy auth module" task (or any other seeded `open` task with room for a new bidder) and confirm success end-to-end, then confirm it appears correctly in `GET /api/tasks/:id/bids`.
2. Attempt each of the four rejection scenarios (self-bid, task not open, duplicate bid, over-capacity) against real seeded data and confirm each specific status code + message.
3. Hit the extended `GET /api/tasks` and manually verify `bidCount`/`lowestBidHours` against the actual seeded bid data for at least two different tasks (one with bids, one with zero bids — confirm the zero-bid case shows `bidCount: 0`, `lowestBidHours: null`, not an error).
4. Confirm ESLint clean, no `.ts` files, no raw `.collection.` calls introduced anywhere in this feature.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm:
- The duplicate-bid MongoDB code-`11000` error is being caught and translated (not just "duplicate bids are rejected somehow") — state where in the code this translation happens.
- That the soft capacity check calls `hasCapacityFor` from Feature 05's `capacity.js` by name, not a reimplementation.
- The audit-log-wiring follow-up is logged again for Feature 08, same as Feature 06's.
