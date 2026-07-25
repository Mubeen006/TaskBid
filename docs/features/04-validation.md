# Feature 04 — Validation Schemas (Joi) + Shared Middleware

**Status:** NOT STARTED
**Depends on:** Feature 01 (Project Setup), Feature 02 (Database Schema) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 1 (#6), Phase 6 (Backend Module Design — validation layer), Phase 13 (Validation Strategy matrix), Phase 14 (Error Handling Architecture)

---

## Goal

Build the shared, reusable validation layer that every subsequent module (Users, Tasks, Bids, Assignment, Dashboard) will plug into: a generic Express middleware that validates request bodies/params against a Joi schema, plus the Joi schemas themselves for every request shape the API will ever accept. This feature produces no working endpoints on its own — it produces the validation infrastructure those endpoints will use.

## Scope (this feature ONLY)

- One generic `validate` middleware factory (`backend/src/middleware/validate.js`) that takes a Joi schema and returns an Express middleware.
- Joi schemas for every request body/param shape named in the Architecture Blueprint's API Contract (Phase 5), grouped per module folder as `*.schema.js` files (co-located with each module, per Phase 3's folder structure), even though the routes themselves don't exist until later features.
- The `express-mongo-sanitize` middleware wired into the app (NoSQL-injection defense, per Architecture Blueprint Phase 15) — this belongs here since it's part of the same "validate everything coming in" concern, even though it's not Joi-based.
- Confirming the central error-handling middleware (already scaffolded in Feature 01) correctly maps a Joi validation failure into the app's standard error envelope with a 400 status.

## Explicitly OUT of scope for this feature
- No route handlers, controllers, or services that actually *use* these schemas end-to-end yet — that wiring happens as each module is built (Features 05–10). This feature only needs each schema to be correct and independently testable.
- No Mongoose-level validation changes — that's Feature 02's territory (schema-level `min`/`max`/`enum`). Joi validates the *shape of the incoming request*; Mongoose validates *what gets persisted*. Keep these two layers distinct — don't duplicate Mongoose's rules into Joi beyond what's needed to give a fast, friendly error before hitting the database.
- No frontend validation (React Hook Form + Joi resolver) — that's Feature 12+.

---

## Middleware Specification

`backend/src/middleware/validate.js` should export a function that:
- Accepts a Joi schema and a target (`'body'`, `'params'`, or `'query'`).
- Runs `schema.validate(req[target], { abortEarly: false })` so all validation errors are collected, not just the first.
- On failure: throws/passes a `ValidationError` (from Feature 01's `domainErrors.js`) to `next()`, with the Joi error's `details` array attached as the error's `details` field — this is what flows into the error envelope's `details` key (per Architecture Blueprint Phase 14).
- On success: replaces `req[target]` with the validated (and Joi-coerced/defaulted) value, so downstream controllers can trust the shape without re-checking it.

## Joi Schemas Required (one file per module, per the API Contract in Architecture Blueprint Phase 5)

**`modules/tasks/tasks.schema.js`**
- `createTaskSchema` — `title` (string, required, max 200), `description` (string, optional), `complexity` (integer, required, 1–5), `deadline` (ISO date string, required).
- `updateStatusSchema` — `targetStatus` (string, required, must be one of the seven lifecycle values — the *shape* check; whether it's the *legal next* status is business logic, not validation, and belongs in Feature 06's service layer, not here).

**`modules/bids/bids.schema.js`**
- `createBidSchema` — `hoursOffered` (number, required, greater than 0).

**`modules/users/users.schema.js`**
- No request-body schema needed yet (the only user-related endpoint, `GET /api/users/:id/workload`, takes no body) — but still create the file with a `userIdParamSchema` (ObjectId-shape string validation for `:id`) so param validation is consistent across all modules.

**Shared / cross-module**
- `utils/objectIdSchema.js` (or similar) — a single reusable Joi schema fragment for "this string must look like a valid MongoDB ObjectId," used by every module's `:id` param validation, so this pattern isn't redefined five different times with five slightly different regexes.

## `currentUser` Middleware (belongs here, same "gatekeeping" concern)

Also build `backend/src/middleware/currentUser.js` in this feature, since it's the same category of "validate what came in before trusting it" concern as the rest of this layer:
- Reads `X-User-Id` from request headers.
- If missing: reject with a 400 (`ValidationError`, "X-User-Id header is required").
- If present but not a valid ObjectId shape: reject with a 400.
- If present and valid-shaped but no such user exists in the database: reject with a 400 (not 404 — the *request* is malformed by referencing a nonexistent actor, distinct from a 404 meaning "the resource you asked for by ID doesn't exist").
- On success: attaches the full resolved user document to `req.currentUser` for downstream use (self-bid checks, audit actor, etc. in later features).

## `mongoSanitize` Wiring

Add `express-mongo-sanitize` to the Express app assembly (`app.js`) as global middleware, positioned before any route handling, so any `$`-prefixed or dot-containing keys in `req.body`/`req.params`/`req.query` are stripped before they can reach a Mongoose query anywhere downstream.

---

## Acceptance Criteria

- [ ] `validate` middleware correctly rejects an invalid payload with a 400 and a `details` array listing every failing field, not just the first.
- [ ] `validate` middleware correctly passes through and normalizes a valid payload (e.g., trims strings if configured, applies Joi defaults).
- [ ] Every schema listed above exists and matches the field/rule list exactly (cross-check against Architecture Blueprint Phase 5 and Phase 13's validation matrix — do not add or drop a rule without a documented reason).
- [ ] `currentUser` middleware correctly rejects: missing header, malformed header value, and header referencing a nonexistent user — three distinct test cases, all 400.
- [ ] `currentUser` middleware correctly attaches `req.currentUser` on success.
- [ ] `express-mongo-sanitize` is active — confirm a request body containing a `$`-prefixed key has that key stripped before reaching any handler.
- [ ] No schema in this feature attempts to validate business rules (self-bid, capacity, status-transition legality, duplicate-bid) — those are explicitly Feature 06/07/09's job, not this feature's. This feature validates *shape only* (types, required-ness, ranges, format).

## Self-Test Checklist (do this before reporting ready)

1. Since no real routes exist yet, write a small disposable test Express app (or use a temporary throwaway route) that mounts `validate(createTaskSchema, 'body')` and confirm both a valid and an invalid payload produce the expected result.
2. Do the same for `currentUser` against a temporary route, using real seeded user IDs from Feature 03 for the "valid" case and a random-but-well-formed ObjectId for the "doesn't exist" case.
3. Confirm the mongoSanitize behavior with a manual request containing an operator-injection-style body (e.g., a field value of `{ "$gt": "" }`) and confirm it's neutralized before reaching your throwaway handler.
4. Remove any throwaway routes/files used only for this self-testing before reporting done — they are not part of this feature's deliverable.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, list every schema file created and, for each, confirm it was checked against Architecture Blueprint Phase 5/13 rather than written from assumption.
