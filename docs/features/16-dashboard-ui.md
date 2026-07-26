# Feature 16 — Dashboard Page + Chart

**Status:** NOT STARTED
**Depends on:** Feature 10 (Dashboard Module — `GET /api/dashboard/stats`), Feature 12 (Frontend Setup) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 9, Phase 10 (Component Tree — Dashboard section), Analysis Blueprint Section 4.3 (Dashboard View requirements)

---

## Goal

Render Feature 10's four stats as a real Dashboard page, including at least one chart (the original assignment's explicit requirement — "must include at least one chart, use any charting library").

## Scope (this feature ONLY)

- `frontend/src/pages/DashboardPage.jsx` — replacing Feature 12's placeholder.
- `frontend/src/features/dashboard/` — `StatCard.jsx`, `ChartPanel.jsx`, `dashboard.api.js`, a `useDashboardStats()` hook.
- Installing Recharts (per the Architecture Blueprint's Technology Stack decision — unless it's already been added; check `frontend/package.json` first).

## Explicitly OUT of scope for this feature
- No new backend changes — this feature only renders what Feature 10 already returns. If you find the shape doesn't quite fit what the UI needs, that's a `BLOCKED`-style finding for the architect, not something to silently patch on the backend from here (same rule as Features 12/14).
- No auto-refresh/polling of the dashboard beyond React Query's normal default behavior — no realtime requirement was ever specified for the dashboard (Feature 15 was scoped to bids/assignment only), so don't add Socket.IO wiring here.

---

## Component Specification

**`useDashboardStats()` hook:** wraps `dashboard.api.js`'s call to `GET /api/dashboard/stats` in a React Query `useQuery`.

**`DashboardPage.jsx`:** renders four sections, one per metric from Feature 10's response:
1. `tasksByStatus` — a `StatCard` or small table showing count per status (7 rows).
2. `avgBidByComplexity` — this is the natural candidate for the required chart (a bar chart: complexity level on the x-axis, average hours on the y-axis) via `ChartPanel.jsx` wrapping Recharts' `BarChart`.
3. `topUsersByCompleted` — a simple ranked list/small table (name + completed count), top 3.
4. `zeroBidPastDeadline` — a simple list of task titles + deadlines; if this list is empty (not currently the case given seeded data, but should be handled regardless), show a clear empty-state message, not a blank gap.

**`ChartPanel.jsx`:** a reusable wrapper around whichever Recharts chart type is used, taking data + basic config as props — keep it generic enough that it isn't hard-coded to only the complexity-vs-hours shape, in case Feature 20's bonus items or future changes want a second chart later (not required now, just don't paint yourself into an unnecessarily narrow corner).

**Loading/error/empty states:** same discipline as every other page in this project (Features 13/14) — a loading skeleton while `useDashboardStats()` fetches, a clear error state on failure, and empty-state handling for any of the four metrics that could plausibly be empty.

---

## Acceptance Criteria

- [ ] All four metrics render, matching Feature 10's established baseline values exactly (7 status entries totaling 10 tasks; the known complexity averages; Sara/Usman as the top completed-task users; "Archive old customer records" in the zero-bid-past-deadline list).
- [ ] At least one chart renders using real data (not placeholder/dummy data) — the complexity-vs-average-hours bar chart is the recommended choice, but any of the four metrics charted is acceptable as long as it's real.
- [ ] A loading state is visible on initial load; an error state renders if the fetch fails (test by temporarily breaking `VITE_API_URL` as done in Feature 13).
- [ ] No `.ts` files; lint clean.

## Self-Test Checklist (do this before reporting ready)

1. Load the dashboard against the real seeded backend and cross-check all four rendered metrics against Feature 10's reported baseline values line-by-line.
2. Confirm the chart renders correctly and its data matches the underlying numbers (not just "a chart appears" — verify at least one bar/data point's value against the known baseline).
3. Force a fetch failure and confirm the error state renders.
4. Resize the browser window / check on a narrower viewport and confirm the chart and stat cards don't break layout catastrophically (a full responsive design pass isn't required, but basic usability at different widths is a reasonable low-effort check).

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, confirm the actual rendered values for all four metrics match Feature 10's reported baseline exactly, and which metric was charted.
