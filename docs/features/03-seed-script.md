# Feature 03 — Seed Script

**Status:** NOT STARTED
**Depends on:** Feature 01 (Project Setup) and Feature 02 (Database Schema) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Analysis Blueprint Phase 3 (hidden requirement: seed script covering every feature path), Architecture Blueprint Phase 3 (`db/seeds/seed.js`), Phase 17/21 (roadmap placement)

---

## Goal

A single Node.js script, run via `npm run seed`, that clears and repopulates the database with demo data covering **every scenario** a reviewer or later feature will need to test — every task status, every dashboard metric, and a capacity configuration that makes the Part-A race condition (Feature 09) demonstrable on seeded data alone, with no manual data entry required first.

## Scope (this feature ONLY)

- One script: `backend/src/db/seeds/seed.js`, run via `npm run seed`.
- Uses the Mongoose models from Feature 02 directly — no raw driver calls, no separate seed data format.
- Clears existing data before inserting (safe to re-run repeatedly against the same DB without manual cleanup).
- Produces enough data to satisfy every acceptance criterion listed below.

## Explicitly OUT of scope for this feature
- No API endpoints (Features 05–10) — the script talks to MongoDB directly via Mongoose models, not through the HTTP API.
- No automated test assertions about the seeded data — that's Feature 17's job. This script only needs to *produce* correct data; verifying it via the app's own endpoints happens once those endpoints exist.
- No CLI flags/options (e.g., `--minimal`, `--large`) — one fixed, comprehensive seed scenario is all this feature needs to deliver.

---

## Required Data Shape

## ⚠️ Required Data-Creation Pattern (read before writing any code)

A prior implementation attempt at this feature ran into a real conflict: attaching a bid to a task that's already `assigned`/`done` gets rejected by the Feature 02 bidding-open guard hook (since that task's current status isn't `'open'` by the time you want to attach its "winning" historical bid). The wrong fix — reaching for `Bid.collection.insertMany()`/`insertOne()` or `Task.updateOne()` to bypass the guard — is **forbidden in this codebase**, here and everywhere else: it skips not just the guard but *all* of Mongoose's schema-level validation (`min`, `enum`, `required`) for those documents, and it's exactly the kind of silent-bypass pattern Feature 02 was corrected to close off (see Feature 02's updated guard-hook section — guards now also fire on `findOneAndUpdate`, so this shortcut wouldn't even work anymore).

**Correct pattern for every task that needs a "winning" bid and a non-`open` final status:**
1. Create the task with `status: 'open'` first (even if its "real" seeded status should be `assigned`/`done`/etc.).
2. Create its bid(s) normally via `Bid.create(...)` while the task is still `open` — this passes both the bidding-open guard and full Mongoose validation.
3. Mark the winning bid's `status: 'assigned'` and any other bids on that task `status: 'not_selected'` via a normal fetch-then-`.save()`, not a raw update.
4. Advance the task through its intermediate statuses one legal forward step at a time using `task.setStatus(nextStatus); await task.save();` (the helper method from Feature 02 — never set `task.status` directly, and never use `Task.updateOne()`/`findOneAndUpdate()` for this) — repeat once per lifecycle step until the task reaches its intended final seeded status (e.g., `open → bidding_closed → assigned → in_progress → review → done` for a `done` task).
5. Set `assignedUser`/`assignedBid` on the task via the same fetch-then-`.save()` used in step 4, at the point the task reaches `'assigned'`.

This is more verbose than the shortcut, but it means the seed script — like every other part of this codebase — never violates the app's own rules to produce its data, and it exercises the full guard/validation path as a side effect, which is itself a useful smoke test that Feature 02 was built correctly.

### Users — at least 5
Must include, by design (not by chance):
- At least **two users near/at capacity** — e.g., one with only a few hours of remaining capacity relative to their `maxCapacityHours`, via a nonzero starting `currentWorkloadHours`. This is what makes Feature 09's Part-A concurrency test (two `/assign` calls competing for the same user's remaining capacity) demonstrable immediately after seeding, without the tester having to manually create that condition first.
- At least one user with `currentWorkloadHours: 0` (plenty of headroom), to serve as an obviously-valid bidder in contrast.

### Tasks — cover every status at least once
Must include at least one task in **each** of the seven lifecycle statuses: `draft`, `open`, `bidding_closed`, `assigned`, **`in_progress`**, **`review`**, `done`. **This means at minimum one task must exist that is currently sitting in `review` status specifically** — don't let this one get missed the way an earlier draft of this script did; it's easy to remember `in_progress` and `done` and forget the `review` step in between. Specifically also include:
- **At least one `open` task with zero bids and a deadline in the past** — this is the exact data shape the dashboard's "zero-bid past-deadline tasks" metric (Feature 10) needs to have something to show; without this, that metric can only ever be tested as an empty list.
- **At least one `open` task with multiple bids from different users, at varying hour amounts** — so the bid-list sort-ascending behavior (Feature 07) and the "lowest bid" display on the Task Board (Feature 13) have something meaningful to render.
- **At least one `bidding_closed` task with multiple bids**, including at least one bid from a user who is at/near capacity — this is the task Feature 09's manual concurrency test should be run against.
- **At least three `done` tasks, assigned across at least two different users**, with enough concentration that the dashboard's "top 3 users by completed tasks" metric (Feature 10) produces a real, non-trivial ranking rather than a three-way tie with nothing to distinguish them.
- Tasks should span a realistic mix of `complexity` values (1–5) — the dashboard's "average bid per complexity level" metric (Feature 10) needs more than one complexity value represented to be worth looking at.

### Bids
- Every non-`draft`, non-`open`-with-zero-bids task should have realistic bid data attached, consistent with its status (e.g., a `done` task's winning bid should have `status: 'assigned'`, and any other bids on that same task should be `status: 'not_selected'`, matching what Feature 09's real assignment logic would have produced).
- No bid should violate the constraints from Feature 02 (no self-bids, no duplicate user+task pairs, bidder ≠ task creator) — the seed script itself must respect these rules, both because the Mongoose guard hooks will reject violations and because seeded data that breaks the app's own rules would be a confusing starting point for testing.

### Audit Log
- Not required to backfill a full audit trail for seeded data (the seed script bypasses the normal service layer, so there's no natural "actor" for these changes) — leave `auditlogs` empty after seeding. The audit log only needs to start recording real entries once Feature 08 wires it into the actual mutating service paths used by the running app.

---

## Acceptance Criteria

- [ ] `npm run seed` clears all four collections and repopulates them without manual intervention.
- [ ] Running `npm run seed` twice in a row produces the same, consistent result both times (idempotent from the operator's point of view, even though it works by clearing first rather than upserting).
- [ ] After seeding, at least one task exists in every one of the seven statuses.
- [ ] After seeding, at least one `open` task exists with zero bids and a `deadline` in the past.
- [ ] After seeding, at least one `open` task exists with 3+ bids at different `hoursOffered` values.
- [ ] After seeding, at least two users exist whose `currentWorkloadHours` is within a small margin of their `maxCapacityHours` (specifically small enough that a single additional bid's worth of hours would push them over).
- [ ] After seeding, at least one `bidding_closed` task exists whose lowest bidder is one of the near-capacity users above — this is the exact task that should be used to manually exercise Feature 09's race condition later.
- [ ] After seeding, `done` tasks are distributed such that at least one user clearly has more completed tasks than others (a real ranking is possible, not a flat tie).
- [ ] No seeded bid violates a Feature 02 guard hook (script runs to completion without any guard-hook rejection errors).
- [ ] The script logs a clear summary on completion (counts of users/tasks/bids created) so it's obvious at a glance that it worked.

## Self-Test Checklist (do this before reporting ready)

1. Run `npm run seed` against the local replica set from Feature 01; confirm it completes without errors and prints the summary.
2. Manually inspect the data via `mongosh` (or Compass) to confirm each acceptance-criteria checkbox above is actually satisfied by the resulting documents — don't just trust that the script "should" produce this, check the real collections.
3. Run `npm run seed` a second time immediately after the first; confirm it still completes cleanly and the resulting data still satisfies every checkbox (catches any accidental reliance on starting from a totally empty DB in a way that wouldn't survive a second run).

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm: how many users/tasks/bids were created, which specific task is the recommended one to use for Feature 09's manual concurrency test (name it), and which two users are the near-capacity pair that task's race condition depends on.
