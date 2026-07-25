# Feature 13 — Task Board Page

**Status:** NOT STARTED
**Depends on:** Feature 06 (Tasks Module — `GET /api/tasks`, now including `bidCount`/`lowestBidHours` from Feature 07), Feature 12 (Frontend Setup) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 9 (Frontend Architecture), Phase 10 (Component Tree — Task Board section), Analysis Blueprint Section 4.1 (Task Board View requirements)

---

## Goal

The kanban-style Task Board: tasks grouped into columns by status, each card showing title, complexity, deadline, bid count, and lowest bid — clicking a card navigates to the Task Detail page (Feature 14, which doesn't have real content yet, but the navigation itself should work).

## Scope (this feature ONLY)

- `frontend/src/features/tasks/` — `TaskColumn.jsx`, `TaskCard.jsx`, `StatusBadge.jsx`, a `useTasks()` hook (React Query wrapping `GET /api/tasks`), and `frontend/src/api/tasks.api.js`.
- `frontend/src/pages/TaskBoardPage.jsx` — replacing Feature 12's placeholder with the real board.
- A `CreateTaskModal`/inline form is **optional** for this feature — see the note below; if you have time, include it, but the acceptance criteria don't require it.

## Explicitly OUT of scope for this feature
- No Task Detail content — clicking a card should navigate to `/tasks/:id`, which still shows Feature 12's placeholder until Feature 14 is built. This is expected and correct at this stage.
- No real-time updates — the board is a plain fetch-on-load (with React Query's normal refetch behavior) until Feature 15 adds live updates.
- No bid placement UI — that's Feature 14 entirely.

---

## Component Specification

**`useTasks()` hook (in `frontend/src/features/tasks/` or `hooks/`):** wraps `tasks.api.js`'s `getTasks()` call in a React Query `useQuery`, returning the tasks array plus loading/error state. No params needed for now (the `?status=` filter from Feature 06 is available server-side but not required to be exposed in this UI unless you have time — client-side grouping by status, done below, achieves the same visual result without needing the filter param).

**`TaskBoardPage.jsx`:** fetches all tasks via `useTasks()`, groups them client-side by `status` into the seven fixed columns (in lifecycle order: `draft, open, bidding_closed, assigned, in_progress, review, done`), renders one `TaskColumn` per status (even if empty — an empty column with an empty-state message is correct, not a bug, per Architecture Blueprint Phase 13's empty-state requirement).

**`TaskColumn.jsx`:** takes a status label and a list of tasks for that status; renders a `TaskCard` per task, or a simple "No tasks" message if the list is empty.

**`TaskCard.jsx`:** displays `title`, `complexity` (e.g., as a small number/badge), `deadline` (formatted via `date-fns` — check if it's been installed yet; if not, this is a reasonable point to add it), bid count, and lowest bid hours (`"3 bids · lowest: 4h"` or similar — handle the zero-bid case gracefully, e.g., `"No bids yet"` rather than `"0 bids · lowest: null"`). Clicking anywhere on the card navigates to `/tasks/:id` via React Router's `useNavigate` or a wrapping `Link`.

**`StatusBadge.jsx`:** a small reusable label component for status, usable here and later reused in Feature 14 (Task Detail) — keep it generic/reusable now rather than board-specific.

**Loading/error/empty states (per Architecture Blueprint Phase 13):**
- Loading: a skeleton or simple loading indicator while `useTasks()` is fetching, not a blank screen.
- Error: if the fetch fails, show a clear error message (using `client.js`'s `ApiError` from Feature 12), not a silent blank board.
- Empty: a column with zero tasks shows an explicit "No tasks in this status" message, not an empty gap that looks broken.

---

## Acceptance Criteria

- [ ] All seven status columns render, in the correct lifecycle order, even for columns with zero tasks.
- [ ] Each task card shows title, complexity, deadline, and bid info (bid count + lowest bid, or a clear "no bids" state) matching what `GET /api/tasks` actually returns.
- [ ] Clicking a task card navigates to `/tasks/:id` with the correct task's id in the URL.
- [ ] A loading state is visible briefly on initial page load (can be confirmed via browser dev tools' network throttling, or simply observing it doesn't flash instantaneously in a way that's untestable).
- [ ] Temporarily pointing `VITE_API_URL` at a wrong port (to force a fetch failure) shows a visible error state, not a blank page or unhandled crash.
- [ ] No `.ts` files; ESLint clean.

## Self-Test Checklist (do this before reporting ready)

1. Load the board against the real seeded backend and visually confirm all 10 seeded tasks appear in their correct columns (cross-check against the known seed data: 1 draft, 2 open, 1 bidding_closed, 1 assigned, 1 in_progress, 1 review, 3 done).
2. Confirm the "Build reporting dashboard" card specifically shows `bidCount: 3`, lowest bid `4h` (per Feature 07's established baseline).
3. Click through to a task's detail route and confirm the URL and (placeholder) page load correctly.
4. Force a fetch error (bad `VITE_API_URL`) and confirm the error state renders instead of a blank page, then revert the env change.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, confirm the actual rendered task counts per column against the known seed baseline (1/2/1/1/1/1/3), and whether a `CreateTaskModal`/form was included or deferred.
