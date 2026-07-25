# Feature 10 — Dashboard Module

**Status:** NOT STARTED
**Depends on:** Feature 02 (Database Schema), Feature 06 (Tasks Module), Feature 07 (Bids Module) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 5 (API Contract), Phase 16 (Performance Strategy — the parallel-four-pipelines justification)

---

## Goal

`GET /api/dashboard/stats`, returning four aggregated metrics via MongoDB aggregation pipelines, run in parallel rather than sequentially, with the choice explicitly justified per Architecture Blueprint Phase 16.

## Scope (this feature ONLY)

- `backend/src/modules/dashboard/dashboard.repository.js`, `dashboard.service.js`, `dashboard.controller.js`.
- Mounting `GET /api/dashboard/stats` in `app.js`.

## Explicitly OUT of scope for this feature
- No caching layer (Architecture Blueprint Phase 16 explicitly says React Query's client-side cache is sufficient — no Redis, no server-side caching here).
- No pagination on any of the four metrics — not required at this data scale.
- No new indexes — the ones from Feature 02 (`tasks.status`, `tasks.deadline`, `bids` compound indexes) already support these queries; if you find yourself needing a new index, flag it as a `BLOCKED` question rather than silently modifying Feature 02's migrations.

---

## The Four Metrics — Exact Aggregation Approach

Per Architecture Blueprint Phase 16: run these as **four separate aggregation pipelines, in parallel via `Promise.all`**, not one combined mega-pipeline — this is a deliberate choice (readability and independent index usage per metric, over marginal round-trip savings at this data volume), and it must be stated as such in your report, since the original assignment brief explicitly asks for this reasoning either way.

1. **Tasks grouped by status:** `Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])`. Response shape: an array of `{ status, count }` (rename `_id` to `status` via `$project` or `$addFields`, don't leak Mongo's `_id` naming into the API response).

2. **Average bid amount per complexity level:** requires joining bids back to their tasks to get `complexity`. Use `$lookup` from `bids` to `tasks` (or the reverse — pick whichever direction reads more naturally, but be consistent), then `$group` by `complexity`, `$avg` on `hoursOffered`. Response shape: array of `{ complexity, averageHours }`.

3. **Top 3 users by completed task count:** `Task.aggregate([{ $match: { status: 'done' } }, { $group: { _id: '$assignedUser', completedCount: { $sum: 1 } } }, { $sort: { completedCount: -1 } }, { $limit: 3 }])`, then a follow-up `$lookup`/population step to attach the user's `name` (don't return raw ObjectIds without names — the Dashboard UI in Feature 16 will need names to render). Response shape: array of `{ userId, name, completedCount }`.

4. **Tasks with zero bids past their deadline:** requires a `$lookup` from `tasks` to `bids`, matching on tasks whose resulting bids array is empty (`$match` on `{ bids: { $size: 0 } }` after the lookup, or an equivalent `$match` before/after depending on your pipeline structure) **and** `deadline < now`. Response shape: array of `{ taskId, title, deadline }`.

Run all four via `Promise.all` in `dashboard.service.js`, and assemble the final response shape:
```
{ tasksByStatus, avgBidByComplexity, topUsersByCompleted, zeroBidPastDeadline }
```

---

## Acceptance Criteria

- [ ] All four metrics are computed via separate aggregation pipelines run in `Promise.all`, not sequential `await`s and not one combined pipeline.
- [ ] `tasksByStatus` reflects the actual seeded distribution across all 7 statuses accurately.
- [ ] `avgBidByComplexity` produces correct averages against the seeded bid data — manually calculate the expected average for at least one complexity level and confirm the endpoint matches.
- [ ] `topUsersByCompleted` correctly identifies Sara and Usman as having completed tasks (per the seeded `done` tasks from Feature 03), with names attached, not raw IDs.
- [ ] `zeroBidPastDeadline` includes the seeded "Archive old customer records" task and excludes any task that either has bids or isn't past its deadline.
- [ ] No `_id`/raw Mongo field names leak into the API response — every field is renamed to a clean, camelCase API-facing name.
- [ ] Response time is reasonable for this data volume (no specific number required, but if any single pipeline takes noticeably longer than the others, investigate whether it's missing an index it should be using from Feature 02).

## Self-Test Checklist (do this before reporting ready)

1. Hit the endpoint against the seeded database and manually cross-check each of the four metrics against what you can see directly in the collections via `mongosh` — don't just trust that the aggregation "looks right," verify the actual numbers.
2. Temporarily add a new `done` task assigned to a 4th user and confirm `topUsersByCompleted` correctly re-ranks (then revert this test data, or re-run the seed script to restore the baseline).
3. Confirm the endpoint doesn't error on an empty edge case if you temporarily clear all bids for one task (confirm `avgBidByComplexity` and `zeroBidPastDeadline` both handle a task with literally zero bids gracefully, without crashing the whole endpoint) — then re-seed to restore normal state.
4. Confirm ESLint clean, no `.ts` files.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly state the actual computed values for all four metrics against the current seeded data (not just "it works") — this becomes the reference baseline Feature 16's Dashboard UI will be checked against later.
