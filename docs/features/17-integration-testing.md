# Feature 17 — Full Integration Pass + Concurrency Test

**Status:** NOT STARTED
**Depends on:** ALL of Features 01–16 must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 17 (Testing Blueprint — the full scenario list)

---

## Goal

This feature produces no new application code (or only small bug fixes discovered along the way — see below). Its deliverable is **verification**: a systematic, end-to-end pass through every scenario across the whole stack, run against the real running system (backend + frontend + real MongoDB), with special emphasis on the Part-A concurrency scenario (already verified in isolation during Feature 09, but never confirmed end-to-end through the actual UI) and the MongoDB-specific failure modes.

## Scope (this feature ONLY)

- Running through every checklist item below against the live, fully-integrated stack.
- Fixing small, genuine bugs discovered during this pass — but see the important distinction below about what counts as "small" vs. what requires flagging back to the architect.
- Optionally: writing a small number of automated tests (Jest) for the highest-value scenarios (the Part-A concurrency test especially) if time allows — the original assignment brief lists this as a bonus item, not a requirement, so don't let this block finishing the pass itself.

## Explicitly OUT of scope for this feature
- No new features, no new UI, no new endpoints.
- **If this pass surfaces a genuine behavioral bug that traces back to an earlier feature's core logic** (not a small integration wiring issue, but something like "the assignment engine's retry logic doesn't actually work end-to-end" or "the guard hooks don't fire correctly in some path") — **do not silently fix it and move on.** Report it clearly as a finding requiring the architect's attention, the same way `MASTER_PROMPT.md`'s `BLOCKED` format works, even though this feature isn't blocked in the sense of being unable to proceed — it's that a "fix" at this stage to core logic built and signed off many features ago deserves the same scrutiny the original build got, not a quick patch during a verification pass.

---

## Full Scenario Checklist

**Task lifecycle, end-to-end through the actual UI:**
- [ ] Create a task via the UI (if Feature 13/14 included a create form) or via Swagger, and walk it through every status via the UI's controls: `draft → open → bidding_closed → assigned → in_progress → review → done`.
- [ ] Confirm an illegal status jump is correctly blocked when attempted via the UI's own controls (not just via a raw API call), and via a raw API call bypassing the UI (confirming the guard holds regardless of entry point).

**Bidding, end-to-end:**
- [ ] Self-bid, duplicate-bid, bidding-closed, and over-capacity rejections all correctly prevent submission or show correct errors when attempted through the actual Bid Form UI, not just the API directly.
- [ ] The stale-capacity scenario (Feature 14) still reproduces correctly in this fully-integrated environment.

**Assignment — the most important scenario in this feature:**
- [ ] **Re-run the Part-A concurrency test, but this time fire the two concurrent `/assign` calls from outside the UI (a script, exactly as in Feature 09) while simultaneously having the Task Detail pages for both affected tasks open in two browser tabs**, confirming: (a) the backend-level outcome is still correct (exactly one success, capacity never overflows — same as Feature 09's isolated test), AND (b) both open browser tabs correctly reflect the outcome via the realtime layer (Feature 15) without manual refresh. This is the full-stack proof that every piece of this project's hardest engineering problem actually works together, not just in isolation.
- [ ] Repeat this combined test at least 3 times to build confidence.
- [ ] No-eligible-bidder and wrong-status paths still behave correctly end-to-end.

**Dashboard:**
- [ ] All four metrics still match the established baseline after all the above testing has potentially changed the seeded data's state (if the data has drifted from the original seed due to testing, either re-seed before this check or manually verify the dashboard reflects whatever the current true state is — don't compare against a stale baseline that no longer matches reality).

**Realtime:**
- [ ] Reconnect-and-reconcile (Feature 15) still works when tested end-to-end alongside everything else, not just in isolation.

**MongoDB-specific failure modes (per Architecture Blueprint Phase 17):**
- [ ] Duplicate-bid MongoDB error (code 11000) is still correctly caught and translated end-to-end through the UI, not just via direct API calls.
- [ ] If feasible to trigger deliberately, confirm a transient-transaction-error retry path still works correctly under this fuller system load (this may be hard to force deliberately at this stage — if you can't cleanly force it, note that rather than skipping the check silently).

**Cross-cutting:**
- [ ] Re-verify the constraint-honesty facts are still accurate as actually built: exactly one of the five original "database-level constraint" requirements (bid uniqueness) is a true MongoDB-engine-level guarantee; the other four are Mongoose-hook-level (self-bid, bidding-open, forward-only-status ×2 for both save and findOneAndUpdate paths). This will feed directly into Feature 18's README.
- [ ] Re-verify the `capacityVersion` / `isGuardViolation` mechanisms discussed across Features 02/08/09/11 are all still functioning as last confirmed — a full pass like this is exactly the right point to catch any regression introduced by later features touching shared files.

---

## Acceptance Criteria

- [ ] Every checklist item above has been run and its outcome explicitly recorded (pass/fail/note), not silently assumed.
- [ ] Any genuine bug found and fixed during this pass is documented: what was found, what was changed, and why it was judged "small enough to fix here" rather than escalated.
- [ ] Any finding judged too significant to fix silently is reported as a flagged finding, not patched.
- [ ] The combined Part-A concurrency + realtime test (the most important item on this list) has been run at least 3 times with consistent, correct results.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, provide the full checklist above with each item's actual recorded outcome — this report is the artifact that will most directly inform what goes into Feature 18's README "known limitations" section, so completeness here matters more than brevity.
