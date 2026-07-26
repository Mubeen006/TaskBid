# Feature 18 — README + DECISIONS.md

**Status:** NOT STARTED
**Depends on:** ALL of Features 01–17 must be TESTED — READY FOR COMMIT before starting this (confirmed true per `TRACKING.md` — Features 01–17 are all `TESTED — READY FOR COMMIT`, Feature 18 is the current focus).
**Blueprint references:** Architecture Blueprint **Phase 19 (README Blueprint — read this in full, it is this feature's primary spec)**, Phase 8 (constraint-honesty table), Phase 7 (concurrency mechanism — source material for the README's `/assign` explanation), Phase 1/Phase 3 (stack-deviation rationale, file placement), Phase 15 (security), Phase 16 (performance/aggregation-pipeline reasoning), Phase 20 (deployment section — preview/placeholder only, Feature 19 hasn't happened yet). Analysis Blueprint Phase 4 (Assumption #12 — the Mongoose/ORM reinterpretation), Phase 6 ("Feature: Audit Log" — hooks-vs-service-call reasoning). `PROJECT_OVERVIEW.md` §5 (cross-cutting rule #7 — constraint honesty is binding, not optional).

---

## ⚠️ Read This First

This feature produces **no new application code**. Its entire deliverable is two documentation files, `README.md` and `DECISIONS.md`, both at the repo root. The engineering is already done and already tested — Features 01–17's `TRACKING.md` rows are the raw material. Your job here is **accurate synthesis and honest writing**, not new design work. Every number, claim, or test result you put in either file must be traceable back to a specific `TRACKING.md` row or feature MD — do not estimate, round generously, or reconstruct a plausible-sounding number from memory of "roughly what happened." If you can't find the source fact, go re-read the relevant feature's `TRACKING.md` row before writing the sentence, don't approximate.

**One structural note before you start:** Feature 19 (Deployment) is `NOT STARTED` as of this feature. That means the "Live URL" and full "Deployment" sections of the README **cannot be written as finished facts** — see the dedicated instruction below on how to handle this without fabricating anything or leaving the document looking broken.

## Goal

Produce the project's first-class submission documentation:
- `README.md` — the reviewer-facing document: what this is, how to run it, how it's built, and an honest account of its guarantees and limitations.
- `DECISIONS.md` — the Parts A–D write-ups, condensed architecture rationale, and the explicit MongoDB-vs-PostgreSQL stack-deviation justification.

## Scope (this feature ONLY)

- `README.md` at the repo root.
- `DECISIONS.md` at the repo root.
- Both files draw their factual content exclusively from what Features 01–17 actually built and actually tested, per `TRACKING.md` and the individual feature MDs — this is a writing/synthesis task, not a chance to introduce new claims about the system.

## Explicitly OUT of scope for this feature

- **No new application code, no new tests, no bug fixes.** If, while writing this documentation, you notice a genuine inconsistency between two `TRACKING.md` rows, or between a `TRACKING.md` claim and what the code actually does, **do not silently patch code or silently paper over the discrepancy in the prose** — report it via `MASTER_PROMPT.md`'s `BLOCKED` format, the same way Feature 17 was instructed to escalate rather than quietly fix core-logic findings.
- **No fabricated deployment content.** Feature 19 hasn't happened. See "Handling the Not-Yet-Deployed Sections" below for exactly what to write instead.
- **No Loom video** — that's a separate human-produced deliverable outside this coding agent's scope entirely; the README only needs a placeholder link slot for it.
- **No Feature 20 (Bonus Items) writeup** unless `TRACKING.md` shows it's actually been done — check its status before writing anything about bonus items as if they exist.
- Do not touch any application file. Do not run ESLint against anything other than confirming you haven't accidentally created a stray `.js`/`.ts` file — this feature's "Definition of Done" is different in kind from every prior feature (see Self-Test Checklist).

---

## `README.md` Specification

Follow Architecture Blueprint Phase 19's section list **exactly**, in this order, with the content substitutions it specifies. For each section below, the source of truth for its factual content is named — pull from there, don't invent.

1. **Title / Overview** — what TaskBid is, one paragraph, matching `PROJECT_OVERVIEW.md` §1's description.
2. **"Why MongoDB/MERN instead of the originally specified PostgreSQL stack"** — Phase 19 specifies this as a new section placed right after the overview. State plainly: the original assignment brief specified PostgreSQL + raw SQL + no ORM; this project deliberately used MongoDB/Mongoose/MERN instead, per the project owner's explicit instruction (`PROJECT_OVERVIEW.md` §1 — this was not an unprompted deviation, say so). Also surface, honestly, Analysis Blueprint Phase 4's Assumption #12: that treating Mongoose as an acceptable ODM is itself a reinterpretation of the original brief's explicit anti-ORM rule (the ban existed to force visible SQL competence; that purpose doesn't map onto MongoDB) — flagged in the blueprint as `RISKY/NEEDS CLARIFICATION`, not `SAFE`. Don't downplay this to make the deviation look cleaner than it is.
3. **Live URL** — see "Handling the Not-Yet-Deployed Sections" below.
4. **Tech stack** — MongoDB + Mongoose, Express, React (Vite, JS only), Node.js, Socket.IO, React Query, Joi, Recharts, react-hook-form, swagger-ui-express/swagger-jsdoc — pull the exact package names/versions actually recorded in `TRACKING.md` (e.g., `recharts@2.15.3`, `date-fns@4.1.0`, `react-hook-form@7.56.4`, `swagger-ui-express@5.0.1`, `swagger-jsdoc@6.2.8`) rather than writing generic "recharts" with no version.
5. **Env vars** — list every var from `backend/.env.example` / `frontend/.env.example` (Feature 01) — read the actual files, don't reconstruct from memory of what a MERN app "usually" needs.
6. **Installation** — per Phase 19's explicit instruction: **must include a clearly labeled subsection for the local MongoDB replica-set initialization step**, not just `docker-compose up`. State the actual mechanism used (per Feature 01's `TRACKING.md` note: "Replica-set initiation is automatic via Docker Compose healthcheck — no manual step needed") — confirm this is still accurate by rereading Feature 01's row rather than assuming, since the original architecture blueprint anticipated a manual `rs.initiate()`-equivalent step and the actual implementation may have simplified this; document whichever is actually true.
7. **Architecture overview** — a condensed narrative (not a re-paste) of the module layering: Controller → Service → Repository, thin controllers, business logic in services, persistence-only repositories, per-module folder structure — reference Architecture Phase 3/6, don't reproduce them wholesale.
8. **Database schema summary** — the four collections (`users`, `tasks`, `bids`, `auditlogs`), key fields, indexes. **Must include the embedding-vs-referencing rationale** for bids (referenced, not embedded — per Analysis Blueprint's data-modeling note: bids are written frequently/independently in realtime, an embedded array risks the 16MB document ceiling and write-contention on the parent task under concurrent submissions) — this is flagged in the blueprint as "the single most important MongoDB-specific data-modeling decision in this project," so it needs real explanation, not a one-line mention.
9. **Constraints explanation — the honesty table.** Reproduce (in README-appropriate prose + a table) Architecture Phase 8's constraint-honesty table: of the five "database-level constraint" requirements from the original assignment, only **no-duplicate-bid** (compound unique index `{ task, user }`) is a true MongoDB-engine-level guarantee; the other four (no self-bidding, no bid after bidding closed, no backward task-status movement, capacity cannot go negative post-assignment) are Mongoose application-layer hooks/validators — real and effective as long as all writes go through the Mongoose models, but not engine-enforced the way a Postgres `CHECK`/trigger/constraint is. State this **plainly, not glossed over** (per `PROJECT_OVERVIEW.md` §5 rule #7, which is binding). Cross-check this section's claims against Feature 17's actual `§9 Constraint-honesty: PASS` findings (raw insert bypasses the self-bid guard — confirmed, expected, and documented, not a bug) before finalizing wording.
10. **`/assign` concurrency explanation.** This is, per the blueprint, "the single most important technical explanation to get right." Explain the two-part mechanism — MongoDB transaction (atomicity within one call) + version-conditioned `findOneAndUpdate` on `capacityVersion` (correctness across two *concurrent* calls) — and **why the transaction alone does not close the race** (Architecture Phase 7's full walkthrough is the source text; write it in your own words, not copy-pasted). Back this with the actual, already-recorded evidence from Feature 09's `TRACKING.md` row: 10/10 concurrency runs passed, retry path confirmed hit in every run, `capacityVersion` incremented exactly once per successful assignment, never an overflow — and Feature 17's confirmation that this holds through the real UI + realtime layer as well (5 combined runs, all pass). Cite these numbers; don't just assert "it works."
11. **Part B / C / D reasoning** — see the dedicated Parts A–D section below (shared content with `DECISIONS.md`; the README version should be a shorter summary with a pointer to `DECISIONS.md` for the full write-up, avoiding duplicating the entire text in both files).
12. **Realtime justification** — Socket.IO choice, room-per-task broadcast strategy, reconnect-and-reconcile behavior — pull the specifics from Feature 15's `TRACKING.md` row (`getIO()` pattern, room-per-task, `bid:created`/`task:assigned` events, actual process-kill-and-restart reconnect test performed, not simulated).
13. **API reference** — list all endpoints actually documented in Feature 11's Swagger spec (9 endpoints, per its `TRACKING.md` row) with method, path, and one-line purpose. Link to `/api-docs` for full detail rather than reproducing the entire OpenAPI spec inline.
14. **Testing** — summarize what was actually tested: each feature's self-test checklist plus Feature 17's full integration pass (48/48 automated checks across 9 sections — name the sections and their pass/fail outcome, pulled directly from Feature 17's `TRACKING.md` row, including the specific findings flagged there, not just "all tests passed").
15. **Deployment** — see "Handling the Not-Yet-Deployed Sections" below.
16. **Known limitations** — see the dedicated section below; this must be complete and honest, not thin.
17. **Future improvements** — reasonable, grounded suggestions: MongoDB Atlas Change Streams/Triggers as the closer analogue to a true DB trigger for the four hook-level constraints (per Architecture Phase 8's explicit note on this, including its stated trade-off: added Atlas-specific infra dependency, steeper learning curve for a time-boxed assessment); the `CreateTaskModal` deferred from Feature 13 (per its `TRACKING.md` note); Feature 20's bonus items if not yet attempted.
18. **Loom link** — a placeholder slot only (e.g., `[Loom video — to be added]`), not authored content.

### Handling the Not-Yet-Deployed Sections (Live URL, Deployment)

Feature 19 has not run yet. Do **not** invent a URL, do **not** write deployment steps as though they've been executed and verified when they haven't. Instead:
- **Live URL section:** write it as an explicit placeholder — e.g., "To be added after Feature 19 (Deployment) is complete." — not a fake or guessed URL.
- **Deployment section:** it is acceptable and expected to describe the *planned* deployment target (MongoDB Atlas M0 + Render + Vercel, per Architecture Phase 20) as the documented plan, clearly labeled as **planned/not yet executed** — distinct in tone and tense from every other section of this README, which describes things that have actually been built and tested. Do not blur this distinction. Flag in your report that this section will need a short follow-up edit once Feature 19 actually completes.

---

## `DECISIONS.md` Specification

Per Architecture Phase 3's file-tree comment: **"Parts A–D write-ups + architecture rationale + stack-deviation note."** Structure:

### Parts A–D

- **Part A — Concurrency (the `/assign` race condition).** Full mechanism explanation (transaction + version-conditioned update), the concrete walkthrough scenario (two tasks, same lowest-hours bidder, near-capacity user — Architecture Phase 7's own worked example, in your own words), and the actual test evidence from Features 09 and 17 (retry-path-hit-every-run, no overflow, 10/10 then 5/5 combined runs). This is fully documented material — write it in full, don't summarize thinly.
- **Part B — Stale bid / bid-time vs. assignment-time capacity.** The soft/advisory bid-time check (Feature 07, `capacity.js`'s `hasCapacityFor`) versus the authoritative assignment-time check (Feature 09) — explain why these are deliberately two separate checks, not one hardened check, referencing the documented "stale bid" interpretation carried through Features 05/07/09.
- **Part C — flag this explicitly, do not guess.** Neither blueprint document in this project's docs defines what "Part C" refers to in the original assignment brief with the same clarity as Parts A, B, and D — Architecture Phase 19 lists "Part B/C/D reasoning" as a required README section without spelling out Part C's specific topic anywhere else in either blueprint document. The most plausible candidate based on adjacent content is the dashboard aggregation-pipeline design reasoning (Architecture Phase 16's parallel-four-pipelines justification, which is explicitly flagged elsewhere as something that "must be documented in README later either way") — but **do not silently assume this and write it up as if confirmed.** Write Part C's section using that content as a reasonable best guess, but prefix it with a one-line, clearly marked note (e.g., "*Note: this project's blueprint documents do not explicitly name Part C's topic — the section below is our best-fit interpretation based on adjacent documentation; please confirm against the original assignment brief.*") so the project owner can correct it in one edit if the guess is wrong, rather than the gap being silently invisible.
- **Part D — Audit log design.** The reframed "DB trigger vs. application-level middleware" choice: Mongoose document middleware (hooks) vs. a manually-called service function vs. MongoDB Atlas Change Streams/Triggers (the closest true trigger-equivalent). State which was actually chosen (per Feature 08: explicit service-call pattern, `audit.service.js`'s `recordChange`, called directly from each mutating service — not a Mongoose `post('save')` hook) and why (Atlas Change Streams require Atlas-hosted MongoDB specifically and add infra surface not justified for this project's scope) — this reasoning is already fully present in Analysis Blueprint Phase 6 and just needs writing up, not re-deriving.

### Architecture Rationale (condensed)

A short narrative covering: stack choice, folder structure/layering (Controller → Service → Repository), schema design (Mongoose models + guard-hook pattern for the four non-engine-level constraints), transaction strategy (which three write-paths are transactional and why: `/assign`, status-transition + audit, bid-creation + audit — per Feature 08's addendum and Architecture Phase 7), and error-handling pattern (typed domain errors + central middleware + Mongoose/MongoDB error translation). This should read as a condensed, project-owner-facing summary — link back to the two full blueprint documents for anyone who wants the exhaustive version, don't duplicate their full content here.

### Stack-Deviation Note

The same "why MongoDB/MERN" content as the README's dedicated section, but framed here as a decisions-record entry rather than a reviewer-facing pitch — include the same honest acknowledgment of Assumption #12's `RISKY/NEEDS CLARIFICATION` classification.

---

## Known Limitations Section — Must Include All of the Following

Do not write a thin or generic "known limitations" section. Pull these specific, already-documented items directly from `TRACKING.md`:

1. **Constraint-guarantee gap:** four of five "database-level constraint" requirements are Mongoose hook-level, not MongoDB-engine-level — bypassable by any write that goes around the Mongoose models (e.g., a raw driver script). Only the bid-uniqueness index is a true engine-level guarantee.
2. **Guard-check ordering (Feature 17 finding a):** the capacity guard fires before the self-bid guard when a bid both self-bids and exceeds remaining capacity — both guards are individually correct; the ordering is a side effect of service-layer check sequencing, not a bug, but worth naming so a reviewer doesn't mistake it for one.
3. **Test-fixture note (Feature 17 finding b):** `Bid.create()` on a `bidding_closed` task correctly triggers the `pre('save')` guard; any test needing to bypass this deliberately (e.g., to test the guard itself) must use `Bid.collection.insertOne()`, not the Mongoose model.
4. **Transient-transaction retry (Feature 17 finding c):** the `TransientTransactionError`/`UnknownTransactionCommitResult` retry path could not be deterministically forced at the full-integration level; its correctness was confirmed via server logs during Feature 09's isolated testing and earlier integration passes, not via a repeatable automated test at this level — name this honestly as a testing-coverage limitation, not a functionality gap.
5. **Frontend/backend capacity-logic duplication** (Architecture Phase 11's footnote): the client-side capacity pre-check in the Bid Form duplicates `capacity.js`'s logic without TypeScript's compile-time drift protection — a manual-discipline risk, named explicitly rather than hidden.
6. **Deferred UI item:** `CreateTaskModal` was deferred in Feature 13 as not required by that feature's acceptance criteria — tasks can currently only be created via the API/Swagger, not through the UI.

---

## Acceptance Criteria

- [ ] `README.md` exists at the repo root with all 18 sections listed above present, in the specified order — none silently dropped or merged.
- [ ] `DECISIONS.md` exists at the repo root with Parts A, B, D fully written from documented material, and Part C explicitly flagged per the instructions above (not silently guessed and presented as confirmed).
- [ ] Every numeric claim, test result, package version, and endpoint count in both files is traceable to a specific `TRACKING.md` row or feature MD — spot-checked in the self-test below.
- [ ] The constraint-honesty table appears in `README.md`, correctly stating only one of five constraints is engine-level.
- [ ] The `/assign` concurrency explanation cites Feature 09's and Feature 17's actual recorded test results (retry-hit-every-run, run counts), not just a theoretical description of the algorithm.
- [ ] The Installation section's replica-set step matches what Feature 01 actually implemented (reread its `TRACKING.md` row — don't assume the blueprint's anticipated manual step is still accurate).
- [ ] Live URL and Deployment sections are clearly marked as pending/planned, with no fabricated URL or falsely-completed deployment narrative.
- [ ] Known Limitations section includes all six items listed above.
- [ ] No application code, test file, or config file is modified by this feature.

## Self-Test Checklist (do this before reporting ready)

1. **Traceability pass:** go through `README.md` and `DECISIONS.md` line by line and confirm every factual claim (a number, a package version, a test result, a design decision attribution) has a specific source in `TRACKING.md` or a feature MD — note any claim you couldn't source, and fix or flag it before reporting ready.
2. **Installation dry-run:** actually follow the Installation section's steps as written (ideally on a clean checkout, or as close to one as feasible) and confirm they work, including the replica-set step — don't just proofread the prose.
3. **API reference cross-check:** confirm every endpoint listed in the README's API reference actually exists in Feature 11's Swagger spec, and that no documented endpoint is missing.
4. **Overstatement hunt:** reread the constraints/honesty section specifically looking for any sentence that could be read as implying a Mongoose hook is an engine-level guarantee — this is the exact failure mode Architecture Phase 8 warns reviewers will notice immediately if glossed over.
5. **Markdown render check:** preview both files (tables, headers, code blocks) to confirm clean rendering.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm:
- That Part C was flagged as an interpretation/ambiguity rather than silently written up as a confirmed fact, and exactly what content you used as the best-fit placeholder.
- That the Live URL and Deployment sections are clearly marked pending Feature 19, with no fabricated content, and that this is noted as needing a short follow-up edit once Feature 19 completes.
- That every number cited in the concurrency and constraint-honesty sections was pulled from a named `TRACKING.md` row (name the feature numbers you sourced from).
- That the Known Limitations section includes all six items listed above, not a subset.
