# Feature 12 — Frontend Setup

**Status:** NOT STARTED
**Depends on:** Feature 01 (Project Setup — Vite scaffold already exists). Backend Features 05–11 should be TESTED — READY FOR COMMIT before this, since the API client built here will be tested against real running endpoints.
**Blueprint references:** Architecture Blueprint Phase 9 (Frontend Architecture), Phase 10 (Component Tree), Phase 11 (State Management Strategy)

---

## Goal

The React app shell: routing, layout, the user-switcher (`CurrentUserContext`), the API client wrapper, and React Query setup — the scaffolding every subsequent frontend feature (13, 14, 16) will build on top of. No real pages with real data yet — this feature produces an empty-but-wired shell.

## Scope (this feature ONLY)

- `frontend/src/App.jsx`, `main.jsx` — router setup, `QueryClientProvider`, `CurrentUserProvider`, top-level `ErrorBoundary`.
- `frontend/src/context/CurrentUserContext.jsx` — the user-switcher.
- `frontend/src/api/client.js` — the shared fetch wrapper.
- `frontend/src/pages/TaskBoardPage.jsx`, `TaskDetailPage.jsx`, `DashboardPage.jsx` — empty placeholder pages, just enough to route to and render a heading, so navigation can be verified end-to-end.
- Package installs: `react-router-dom`, `@tanstack/react-query`, `axios` (or continue with native `fetch` — your choice, state which in your report; either is acceptable, but be consistent throughout the project once chosen).

## Explicitly OUT of scope for this feature
- No real Task Board / Task Detail / Dashboard content — those are Features 13, 14, 16.
- No Socket.IO client setup — Feature 15.
- No forms, no React Hook Form setup yet — Feature 14.
- No Tailwind/styling decisions beyond whatever minimal setup is needed to confirm the app renders — visual design is not this feature's concern.

---

## `CurrentUserContext` Specification

- On mount, fetch the list of users from the backend (there's no dedicated `GET /api/users` list endpoint per the established API surface — check with the backend modules; if one doesn't exist, the pragmatic choice for this feature is to fetch users via a small, explicitly-scoped addition, or hardcode the five seeded users' names/ids for the switcher dropdown as a temporary measure and flag this clearly in your report as a follow-up. **Do not silently add a new backend endpoint as part of a frontend feature** — if you need one, report it as a `BLOCKED`-style finding for the architect to spec properly, don't improvise the backend side here).
- Holds the currently-selected user (id + name, enough to display and to send as the `X-User-Id` header) in React state.
- Exposes a `useCurrentUser()` hook returning `{ currentUser, setCurrentUser, users }` (or similar).
- Optionally persists the selection via `sessionStorage` (per Architecture Blueprint Phase 11's suggestion) so a page refresh during testing doesn't reset it — this is a small, low-risk quality-of-life addition, not required but recommended.

## `api/client.js` Specification

- A single function/module that wraps outgoing requests, automatically:
  - Prefixes `VITE_API_URL` (from `.env`) to every request path.
  - Injects the `X-User-Id` header from the current user context (needs to be called with access to the current user — either via a parameter, or by having the calling code read it from context and pass it in; don't reach into React context from inside a non-React module in a way that breaks outside of component render).
  - Normalizes error responses: on a non-2xx response, throw a typed `ApiError` (a plain JS class, not a Mongoose/backend error type — this is a frontend-side error class) carrying the backend's `error.code`/`error.message`/`error.details`, so calling code (React Query's `onError`) can handle it uniformly.
- Feature-specific API modules (`tasks.api.js`, `bids.api.js`, `dashboard.api.js`) will be built in Features 13/14/16 on top of this client — this feature only builds the shared client itself, not those per-feature modules.

## Routing

Three routes: `/` or `/board` → `TaskBoardPage`, `/tasks/:id` → `TaskDetailPage`, `/dashboard` → `DashboardPage`. A simple nav header (can be minimal/unstyled for now) linking between Board and Dashboard, plus the user-switcher dropdown, both visible on every page via a shared `AppLayout`.

---

## Acceptance Criteria

- [ ] App starts (`npm run dev` in `frontend/`) and renders without console errors.
- [ ] Navigating between `/`, `/dashboard`, and a placeholder `/tasks/:id` (with any fake id) all render their respective placeholder pages without crashing.
- [ ] The user-switcher dropdown is visible on every page (via the shared layout) and changing the selection updates `useCurrentUser()`'s value, confirmable via a temporary console log or on-screen display of the current selection.
- [ ] `api/client.js` successfully calls at least one real backend endpoint (e.g., `GET /health` or `GET /api/dashboard/stats`) as a smoke test, with the `X-User-Id` header correctly attached when a user is selected, and correctly throws a typed `ApiError` when pointed at a deliberately broken URL.
- [ ] No TypeScript files introduced; ESLint clean.
- [ ] Whether users are fetched from a real endpoint or temporarily hardcoded is explicitly stated in the report, with a flagged follow-up if hardcoded.

## Self-Test Checklist (do this before reporting ready)

1. Manually click through all three routes via the nav header, confirming each renders.
2. Change the user-switcher selection and confirm (via temporary on-screen text or console log) that the context value actually updates.
3. Trigger one successful API call and one deliberately failing API call (e.g., a wrong path) through `api/client.js` and confirm the success/error handling both behave as expected.
4. If `sessionStorage` persistence was added, refresh the page after selecting a non-default user and confirm the selection survives the refresh.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly state:
- Whether `fetch` or `axios` was used (this becomes the standing convention for Features 13/14/16 to follow).
- How the user-switcher's user list is currently sourced (real endpoint vs. temporary hardcode) and, if hardcoded, that this is flagged as a follow-up requiring an architect decision on whether to add a `GET /api/users` list endpoint.
