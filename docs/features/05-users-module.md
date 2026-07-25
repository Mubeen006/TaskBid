# Feature 05 — Users Module (Workload Endpoint + Shared Capacity Utility)

**Status:** NOT STARTED
**Depends on:** Feature 02 (Database Schema), Feature 04 (Validation Schemas) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 5 (API Contract — `GET /users/:id/workload`), Phase 6 (Backend Module Design), Phase 12 of the Analysis Blueprint / Architecture Phase 4 (`currentWorkloadHours`/`capacityVersion` fields)

---

## Goal

Two things, both small but foundational: (1) the `GET /api/users/:id/workload` endpoint, and (2) the **shared `capacity.js` utility** — the single source of truth for "how much remaining capacity does this user have," which Features 07 (bid-time soft check) and 09 (assignment-time authoritative check) will both import. Getting this utility right and genuinely shared (not reimplemented per-module) matters more than the endpoint itself — see `docs/PROJECT_OVERVIEW.md` section 5, rule #3.

## Scope (this feature ONLY)

- `backend/src/utils/capacity.js` — pure functions, no DB access inside them (they operate on a user document/object already fetched by the caller).
- `backend/src/modules/users/users.repository.js` — thin wrapper around `User.findById`.
- `backend/src/modules/users/users.service.js` — fetches the user, throws `NotFoundError` if missing, uses `capacity.js` to compute the response shape.
- `backend/src/modules/users/users.controller.js` — Express Router, one route, wires `validate` + the service.
- Mounting this module's router in `backend/src/app.js` under `/api/users`.

## Explicitly OUT of scope for this feature
- No mutation of `currentWorkloadHours`/`capacityVersion` anywhere in this feature — this feature only *reads* capacity, it never writes it. Writing it is exclusively Feature 09's job (inside the assignment transaction).
- No bid-time or assignment-time capacity *checks* against a specific requested amount of hours yet — this feature only reports the user's current numbers. Features 07/09 will call into `capacity.js` to answer "does X hours fit," using the function(s) this feature defines, but the actual check call-sites belong to those features.
- No `X-User-Id`/`currentUser` middleware requirement on this specific endpoint — per Architecture Blueprint Phase 5, this GET endpoint's contract doesn't require the header (unlike the POST/PATCH endpoints in later features). Don't add it here just for consistency; only add middleware a feature's own contract actually calls for.

---

## `capacity.js` Specification

Export at least these two functions (naming can be adjusted, but the shape/behavior must match):

- **`getRemainingCapacity(user)`** — takes a user document/object (must have `currentWorkloadHours` and `maxCapacityHours`), returns `maxCapacityHours - currentWorkloadHours` (a plain number, can be negative in theory though that should never happen given the guards elsewhere — don't clamp it to zero here, let the caller decide what a negative value means in their context).
- **`hasCapacityFor(user, hoursRequested)`** — takes a user document/object and a number, returns a boolean: `getRemainingCapacity(user) >= hoursRequested`. This is the exact function Feature 07's bid-time soft check and Feature 09's assignment-time authoritative check will both call — do not let either of those features reimplement this comparison inline later; if you're building this feature and can already see the shape both future call-sites will need, make sure this function's signature accommodates both (it should — a boolean over a user + requested-hours is generic enough for both a "can I bid this much" check and a "can I assign this much" check).

Keep this file free of any Mongoose/DB-access code — it should be usable against a plain `{ currentWorkloadHours, maxCapacityHours }` object in a unit test just as easily as against a real Mongoose document, which matters for how easy Feature 17's testing pass will be later.

## Endpoint Specification

**`GET /api/users/:id/workload`**
- Validate `:id` via `validate(userIdParamSchema, 'params')` from Feature 04.
- Service: fetch the user by id; if not found, throw `NotFoundError('User not found')`.
- Response shape (200): `{ userId, currentWorkloadHours, maxCapacityHours, remainingCapacityHours }` — `remainingCapacityHours` computed via `getRemainingCapacity()`, not recalculated inline in the controller or service.
- Errors: 404 if the user doesn't exist (via the central error-handling middleware from Feature 01, which already knows how to render a `NotFoundError`).

## Router/Mounting Convention (establishing the pattern future modules will follow)

`users.controller.js` should export an Express `Router` instance with its route(s) defined on it (e.g., `router.get('/:id/workload', validate(...), handler)`), not a bare handler function — this is the pattern Features 06, 07, 09, and 10 will all follow for consistency, so get the shape right here first. Mount it in `app.js` as `app.use('/api/users', usersRouter)`.

---

## Acceptance Criteria

- [ ] `capacity.js` exports `getRemainingCapacity` and `hasCapacityFor`, both pure functions with no DB/Mongoose dependency.
- [ ] `GET /api/users/:id/workload` with a valid, existing seeded user id (e.g., Bilal's) returns 200 with the correct four fields, and `remainingCapacityHours` matches `maxCapacityHours - currentWorkloadHours` for that user's actual seeded values (e.g., Bilal: 15 − 13 = 2).
- [ ] `GET /api/users/:id/workload` with a well-formed but nonexistent ObjectId returns 404 via the standard error envelope.
- [ ] `GET /api/users/:id/workload` with a malformed `:id` (not ObjectId-shaped) returns 400 via Feature 04's `validate` middleware — confirming Feature 04's `userIdParamSchema` is actually wired in here, not just defined and unused.
- [ ] No capacity-mutation code exists anywhere in this feature.

## Self-Test Checklist (do this before reporting ready)

1. Unit-style test (disposable script or a real test file if you're ready to start using Jest here) for `capacity.js` alone: a user at exactly full capacity (`hasCapacityFor` returns `false` for any positive request, `true` for a `0`-hour request), a user with plenty of headroom, and a user already over capacity (negative remaining) — confirm `getRemainingCapacity` returns the correct negative number rather than clamping.
2. Hit the live endpoint (via `curl`, Postman, or similar — Swagger UI isn't set up until Feature 11, so manual HTTP calls are fine for this feature) with: a valid seeded user id, a nonexistent-but-valid-shaped id, and a malformed id — confirm all three response shapes match the acceptance criteria.
3. Confirm ESLint clean, no `.ts` files introduced.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm the exact function names exported from `capacity.js` (since Features 07 and 09 will need to import them by these exact names — if you name them something other than `getRemainingCapacity`/`hasCapacityFor`, say so clearly here so `docs/PROJECT_OVERVIEW.md` and the later feature MDs can be updated to match before those features start).
