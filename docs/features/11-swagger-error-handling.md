# Feature 11 — Swagger/OpenAPI Setup + Backend Error Handling Pass

**Status:** NOT STARTED
**Depends on:** Features 05–10 (all backend endpoint modules) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 14 (Error Handling Architecture), `MASTER_PROMPT.md`'s Swagger convention

---

## Goal

Two things: (1) document every backend endpoint built so far in an OpenAPI spec reachable at `/api-docs`, and (2) do a single consistency pass across all nine backend modules' error handling before frontend work begins — this is the natural checkpoint for it, since every backend endpoint now exists.

## Scope (this feature ONLY)

- `backend/src/docs/swagger.js` (or equivalent — an OpenAPI spec definition, whether hand-written JSON/YAML or generated via JSDoc comments + `swagger-jsdoc`, your choice, state which in your report).
- Wiring `swagger-ui-express` (or equivalent) into `app.js` at `/api-docs`.
- A read-through of every controller/service across Features 05–10, checking each against the consistency criteria below — this is a review pass, not new business logic. Fix what you find; don't add new features.

## Explicitly OUT of scope for this feature
- No new endpoints, no new business logic.
- No frontend work — Swagger UI is a backend-only, developer-facing tool at this stage.
- No changes to the actual error *messages* users see unless they're found to be genuinely inconsistent with the documented envelope shape — this isn't a copywriting pass, it's a structural consistency pass.

---

## Swagger Documentation Requirements

Document every endpoint that exists as of Feature 10:
- `GET /health`
- `GET /api/users/:id/workload`
- `POST /api/tasks`, `PATCH /api/tasks/:id/status`, `GET /api/tasks`
- `POST /api/tasks/:id/bids`, `GET /api/tasks/:id/bids`
- `POST /api/tasks/:id/assign`
- `GET /api/dashboard/stats`

For each: method, path, path/query params, request body schema (where applicable — can reference the Joi schemas conceptually, doesn't need to auto-derive from them unless that's a low-effort win), possible response status codes with example shapes for at least the success case and the most common error case, and whether the `X-User-Id` header is required (per each endpoint's actual established contract — cross-check against the feature MDs, don't guess).

Swagger UI must be reachable at `http://localhost:4000/api-docs` (or the equivalent port) once the backend is running, and every endpoint listed above must be exercised through it at least once as part of this feature's self-test — not just declared in the spec and never actually tried.

## Error Handling Consistency Pass — Checklist to Run Across All Modules

Go through `users`, `tasks`, `bids`, `audit`, `assignment`, `dashboard` and confirm, for each:
- [ ] Every thrown error is one of the typed domain error classes (`NotFoundError`, `ValidationError`, `ForbiddenError`, `ConflictError`, `UnprocessableError`) or, for Feature 09's retry-exhausted case specifically, the documented plain-`Error`-with-attached-`statusCode`/`code` pattern — no bare `throw new Error('...')` anywhere else that would fall through to a generic 500 when a more specific status code is warranted.
- [ ] No endpoint leaks a raw Mongoose/MongoDB error message directly to the client (e.g., a raw validation error string, a raw duplicate-key message) — everything user-facing should have gone through an explicit translation step, per each feature's own established pattern (Feature 07's `translateBidCreateError` is the reference example).
- [ ] Every 500-level response in practice (test this by trying to deliberately trigger a couple of unexpected errors, e.g., temporarily disconnecting the DB mid-request) returns the generic "Something went wrong" message from the central error handler, never a stack trace or internal detail, while the full detail is still logged server-side.
- [ ] Status codes are used consistently with their meaning across all modules — no module uses 400 where another uses 422 for the same *category* of problem (e.g., "business rule violated" should consistently be 409/422 depending on which specific rule, not sometimes 400).

## Explicitly OUT of scope, restated

If this pass surfaces something that looks like a **behavioral** bug (not just an inconsistent status code or leaking error message) — e.g., you notice during this review that some endpoint doesn't handle an edge case its own feature MD required — do not silently fix it as part of this feature. Note it as a `BLOCKED`-style finding in your report instead, since it means an earlier feature's sign-off may need to be revisited, which is a judgment call for the project owner/architect, not something to resolve unilaterally here.

---

## Acceptance Criteria

- [ ] `/api-docs` is reachable and lists all nine endpoints (including `/health`).
- [ ] Every endpoint has been manually exercised through Swagger UI at least once, success and at least one error case.
- [ ] The error-handling consistency checklist above has been run across all six modules, with findings reported explicitly (even if the finding is "no issues found").
- [ ] Any genuinely new bug found during this pass (as opposed to a cosmetic/consistency issue) is reported as a finding, not silently patched.

## Self-Test Checklist (do this before reporting ready)

1. Start the backend fresh, open `/api-docs`, and walk through every listed endpoint via the Swagger UI's "Try it out" feature.
2. Deliberately trigger at least three different error categories through Swagger UI (e.g., a 404, a 409, a 422) and confirm the response envelope shape is consistent across all three.
3. Deliberately trigger one unexpected/infrastructure-style error (e.g., pass a query that would cause a genuine unhandled exception, or briefly stop the Mongo container mid-test) and confirm the client sees only the generic message, never a stack trace, while the server log shows the full detail.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, list the outcome of the error-handling consistency checklist explicitly per module (not just "all good") — e.g., "tasks: no issues; bids: no issues; assignment: retry-exhausted error uses the plain-Error pattern as documented, confirmed correct; dashboard: no issues" — so there's a clear record of what was actually checked.
