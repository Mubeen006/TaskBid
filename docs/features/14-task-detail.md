# Feature 14 — Task Detail Page + Bid Form

**Status:** NOT STARTED
**Depends on:** Feature 05 (Users Module — workload endpoint), Feature 07 (Bids Module), Feature 09 (Assignment Engine — for showing assignment state), Feature 13 (Task Board Page) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 9, Phase 10, Phase 13 (Validation Strategy — client-side capacity pre-check), Analysis Blueprint Section 4.2 (Task Detail View requirements)

---

## Goal

The full Task Detail page: task info, bid list, and — the single most detail-sensitive piece of frontend work in this project — a bid form with client-side capacity validation that correctly handles the case where the bidder's capacity changed between page load and form submit (the exact scenario the original assignment brief calls out explicitly).

## Scope (this feature ONLY)

- `frontend/src/pages/TaskDetailPage.jsx` — replacing Feature 12's placeholder.
- `frontend/src/features/bids/` — `BidList.jsx`, `BidRow.jsx`, `BidForm.jsx`, `bids.api.js`, a `useBids(taskId)` hook, a `useCreateBid()` mutation hook.
- `frontend/src/features/tasks/` additions: `useTask(id)` hook (single-task fetch — see the note below on whether a dedicated endpoint exists), `useWorkload(userId)` hook wrapping Feature 05's endpoint.
- React Hook Form + a validation resolver — confirm whether Joi's resolver package (`@hookform/resolvers/joi`) is being added now for the first time; if so, install it and use the *shape* of Feature 04's `createBidSchema` conceptually (client-side schema can be a lightweight JS re-declaration, doesn't need to literally import server code across the client/server boundary).

## Explicitly OUT of scope for this feature
- No real-time bid updates — Feature 15. The bid list refetches via React Query's normal mechanisms (e.g., on window refocus, or a manual refetch after a successful submit), not live push, until Feature 15.
- No assignment-trigger button — check Architecture Blueprint Phase 10's component tree: an "Assign" action is part of this page conceptually, but wire it as a simple button calling the existing `POST /api/tasks/:id/assign` endpoint directly via a `useAssignTask()` mutation hook; don't build any new UI sophistication around it beyond a button + result feedback, since assignment is normally triggered by a manager role this project doesn't model with real permissions.
- No status-advance control beyond what's simple to wire — same treatment as the assign button: a basic control calling Feature 06's `PATCH /api/tasks/:id/status`, not a polished workflow UI.

---

## Single-Task Fetch — Resolve Before Building

Check `TRACKING.md`/Feature 06's row: did Feature 06 add a `GET /api/tasks/:id` endpoint, or only the list endpoint? If only the list endpoint exists, you have two choices — pick one, state which in your report:
- **(a)** Reuse the existing `GET /api/tasks` list fetch and find the matching task client-side (acceptable if the task list is already being fetched elsewhere and cached by React Query — avoids a new endpoint for a small win).
- **(b)** Request a `GET /api/tasks/:id` endpoint be added — if you need this, report it as a `BLOCKED`-style finding rather than silently adding it yourself, per the same rule from Feature 12 about not improvising backend endpoints inside a frontend feature. **Recommendation: prefer (a)** if it works reasonably well, since a single-task detail endpoint returning materially different data than the list endpoint isn't obviously needed here (the list endpoint already includes bid summary info per Feature 07) — but if you find the list endpoint's shape is missing something the detail page genuinely needs (e.g., `description`, which may not need to be in the list view), that's a legitimate reason to flag needing the dedicated endpoint rather than option (a).

## Bid Form — The Critical Part

**Client-side capacity pre-check:** on form mount (or when the current user changes via the switcher), fetch the current user's workload via `useWorkload(currentUser.id)` (Feature 05's endpoint). Show the user their remaining capacity near the form (e.g., "You have 2h of capacity remaining"). As the user types an hours value, show inline validation if it exceeds their remaining capacity — this is a **client-side convenience check only**, not authoritative (per Architecture Blueprint Phase 8/13 — the server's soft check in Feature 07 is still the real gate, and the server can still reject a submission the client thought was fine, precisely because capacity can change between page load and submit).

**Handling the stale-capacity-at-submit scenario (the original assignment's explicit callout):** on submit, if the server rejects the bid with a 422 (capacity exceeded — Feature 07's `UnprocessableError`), the form must show a clear, specific message (e.g., "Your available capacity has changed since this page loaded — you now have Xh remaining") rather than a generic error, and should **refetch the user's current workload** so the displayed remaining-capacity number is corrected immediately, without requiring a full page reload. This is the single most important UX detail in this feature — it's not enough to just show *an* error; the error must explain *why* (capacity changed) and *fix the displayed state* so the user isn't stuck looking at a stale number.

**Other bid-form states to handle:**
- Bidding not open (409 from server) — hide/disable the form entirely if `task.status !== 'open'`, don't rely solely on a failed submit to communicate this.
- Self-bid (403) — hide/disable the form if `currentUser.id === task.createdBy`, same reasoning.
- Duplicate bid (409) — if the bid list already shows a bid from the current user on this task, hide/disable the form proactively rather than waiting for a failed submit.
- Successful submit — clear the form, refetch the bid list (or rely on the mutation's `onSuccess` to invalidate the relevant React Query cache key), show a brief success indicator.

---

## Acceptance Criteria

- [ ] Task Detail page shows full task info (title, description, complexity, deadline, status) and the full bid list, sorted ascending by hours (matching Feature 07's endpoint behavior).
- [ ] Bid form is visible and enabled only when `task.status === 'open'`, current user isn't the creator, and current user hasn't already bid.
- [ ] Submitting a valid bid succeeds, clears the form, and the new bid appears in the list without a manual page refresh.
- [ ] Submitting a bid that exceeds current capacity is rejected client-side before any network call, with a clear inline message.
- [ ] **The stale-capacity scenario is demonstrable:** using two browser tabs (or the switcher to simulate two users), place bids as a user until their capacity is nearly exhausted from a *different* task's assignment happening in between, then attempt a bid on this page that the client-side check would have allowed based on stale data — confirm the server-side 422 is caught and displayed with the specific "capacity has changed" message, and the displayed remaining-capacity number updates.
- [ ] Assign button (visible only when `task.status === 'bidding_closed'`) successfully triggers `POST /api/tasks/:id/assign` and reflects the result (success or the specific no-eligible-bidder message) without a page reload.
- [ ] No `.ts` files; lint clean.

## Self-Test Checklist (do this before reporting ready)

1. Open a seeded `open` task with room for a new bidder as a user who hasn't bid yet; place a valid bid and confirm it appears immediately.
2. Attempt a bid exceeding current capacity and confirm the client-side block.
3. Manually reproduce the stale-capacity scenario described in the acceptance criteria (this may require coordinating two API calls — e.g., use Swagger UI or a script to change the user's workload via a different task's assignment between this page's load and this page's submit) and confirm the specific error message and state correction.
4. Open the "Migrate legacy auth module" seeded task (the one used for Feature 09's Part-A test) as its creator (Ayesha) and confirm the bid form is correctly hidden/disabled (self-bid case).
5. Confirm the assign button appears only on `bidding_closed` tasks and produces a correct result.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm: which option ((a) or (b)) was taken for single-task fetching; that the stale-capacity scenario was actually reproduced and tested, not just assumed to work from the code; and whether `@hookform/resolvers/joi` (or an equivalent) was newly installed.
