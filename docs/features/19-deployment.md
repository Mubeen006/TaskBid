# Feature 19 — Deployment (Atlas + Render + Vercel)

**Status:** NOT STARTED
**Depends on:** ALL of Features 01–18 must be TESTED — READY FOR COMMIT before starting this. Per `TRACKING.md`, Features 01–17 are confirmed; Feature 18 was reported ready and is awaiting the project owner's review/commit — confirm Feature 18's status has actually flipped to `TESTED — READY FOR COMMIT` in `TRACKING.md` before starting this feature, since this feature edits `README.md` at the end (see Scope) and shouldn't race ahead of that commit.
**Blueprint references:** Architecture Blueprint **Phase 20 (Deployment Blueprint) — this feature's primary spec**, Phase 1 (#12 — deployment-strategy decision: Atlas M0 + Render + Vercel), Phase 3 (env var / folder placement), Phase 15 (security — CORS, secrets in env vars, unchanged from original). Analysis Blueprint Phase 3 (deployment must be live, free-tier, functional at review time, **stable for ≥2 weeks**), Phase 5 Q9 (cold-start tolerance — open clarification question, not yet resolved), Phase 13 (deployment substitution table).

---

## Goal

Get the real, working system running in production: MongoDB Atlas (M0 free tier) for the database, Render for the backend, Vercel for the frontend — then verify it actually works end-to-end against the live, Atlas-hosted replica set specifically, not just re-confirm what local Docker Compose already proved. This includes the one verification step that genuinely can't be done locally: **confirming the transaction + version-conditioned concurrency mechanism (Feature 09's core deliverable) behaves correctly against Atlas's real 3-node replica set**, not just a single-node local one.

This feature also closes Feature 18's one deliberately-left-open follow-up: `README.md`'s "Live URL" and "Deployment" sections, which were written as explicit placeholders pending this feature.

## Scope (this feature ONLY)

- Provisioning and configuring a MongoDB Atlas M0 cluster.
- Deploying the backend to Render, configured against the Atlas connection string.
- Deploying the frontend to Vercel, configured against the deployed Render backend URL.
- Running `migrate-mongo up` and the seed script against the Atlas-hosted database (not local).
- Production verification / smoke tests, including a live concurrency check.
- **The one permitted content edit outside this feature's own deliverables:** updating `README.md`'s "Live URL" and "Deployment" sections (only these two, per Feature 18's explicit instruction) to reflect what was actually deployed and verified — replacing the "pending Feature 19" placeholders with real content.

## Explicitly OUT of scope for this feature

- **No new application code, no new endpoints, no new UI.** This feature configures and verifies what's already built.
- **No changes to backend business logic.** If something behaves differently in production than locally, the default assumption should be a configuration/environment difference (connection string format, env var missing, CORS origin mismatch), not a logic bug — investigate as configuration first. If a genuine application-logic bug is found that only manifests under production conditions (e.g., an Atlas-specific driver behavior difference), treat it the way Feature 17 was instructed to treat significant findings: **do not silently patch core logic — report it clearly** rather than quick-fixing something that was already signed off in an earlier feature.
- **No rewrite of any other README section** beyond Live URL and Deployment — do not "improve" or restructure anything else in `README.md` or touch `DECISIONS.md` at all.
- **No Feature 20 (Bonus Items)** — separate feature, only attempted after this one, per the roadmap.
- **No committing to Anthropic's — sorry, no committing to git** — same standing rule as every feature (`MASTER_PROMPT.md` hard rule #7): you prepare, deploy, and verify; the project owner reviews and is the one who treats this as "live."

---

## Step 1 — MongoDB Atlas Setup

- Provision a free **M0** cluster (ships as a 3-node replica set by default — this is what makes transactions work in production **without** the manual replica-set initiation that local Docker Compose needed, per Architecture Phase 20's explicit note that this is actually *easier* than local setup, not harder).
- Network access: whitelist Render's outbound IP if it's stable/discoverable, **or** use Atlas's "allow access from anywhere" (`0.0.0.0/0`) — the blueprint explicitly permits this for a time-boxed assessment **as long as it's documented as a deliberate simplification**, not silently left open without comment. State which option you took and why in your report.
- Create the database user/credentials that will back `MONGODB_URI` for the Render deployment. Do not reuse any local-only credential; treat this as a genuinely separate secret.

## Step 2 — Production Migration + Seed (against Atlas, not local)

- Run `migrate-mongo up` against the **Atlas** connection string to apply the same 4 index migrations Feature 02 built and verified locally (compound `{ task, hoursOffered }` on bids, single-field `status`/`deadline` on tasks, compound `{ entityType, entityId }` on auditlogs, unique `email` on users — confirm this matches Feature 02's actual applied set, don't assume from memory).
- Run the seed script (`node seed.js`) pointed at the same `MONGODB_URI`, producing the same baseline data Feature 03 established locally: 5 users, 10 tasks, 15 bids, all 7 statuses represented, the same near-capacity users (Bilal 13/15h, Usman 8/10h) and the same race-condition-ready task ("Migrate legacy auth module," `bidding_closed`, lowest bidder Bilal at 2h).
- Confirm the seed script's idempotency (already established locally in Feature 03) holds against Atlas too — running it twice should not duplicate data.

## Step 3 — Render Backend Deployment

- Deploy `backend/` to Render as a Node/Express web service.
- Environment variables to set on Render (pull the actual full list from `backend/.env.example`, don't reconstruct from memory — Feature 01 built this file): at minimum `MONGODB_URI` (the Atlas connection string from Step 1), `NODE_ENV=production`, `PORT` (Render-assigned), and `CORS_ORIGIN` (the Vercel frontend's deployed URL — per Feature 15's `TRACKING.md` note, `socket.js`'s CORS logic uses `origin: "*"` only when `NODE_ENV=development`; production must set a real `CORS_ORIGIN` value, not wildcard).
- Confirm the `/health` endpoint (Feature 01) responds correctly once deployed — this is the first smoke test, before anything more elaborate.
- Confirm Socket.IO/WebSocket connections work on Render specifically — Architecture Phase 20 notes this is identical to any Node/Express app regardless of database choice, but it still needs an actual verification pass here, not an assumption.

## Step 4 — Vercel Frontend Deployment

- Deploy `frontend/` to Vercel.
- Environment variables: `VITE_API_URL` pointed at the deployed Render backend's URL (per Feature 16's self-test note, this is the same variable that was temporarily broken to test the error state locally — confirm the production value is correct, not left at a local `localhost` default). If a separate socket URL env var exists (check `frontend/.env.example` from Feature 01/15 — don't assume the name), set it too.
- Confirm the deployed frontend actually loads and can reach the deployed backend (a blank page or a permanent loading skeleton means an env var or CORS misconfiguration — treat as a Step 3/4 configuration bug, not a Feature 12–16 code bug, unless investigation proves otherwise).

## Step 5 — Production Verification / Smoke Tests

Per Architecture Phase 20's explicit "Production verification" instruction, this is not optional and not just "does the homepage load":

1. **Health check:** `GET /health` returns correctly.
2. **Full task lifecycle smoke test:** create a task, walk it through at least a few statuses, place a bid, via either the live UI or Swagger UI — confirm the deployed system's core CRUD path works end-to-end against Atlas.
3. **Duplicate-bid MongoDB smoke test** (explicitly named in Architecture Phase 20): attempt a duplicate bid against the live system and confirm the `code: 11000` → `409 ConflictError` translation still works in production exactly as it did in Feature 07/17's local testing.
4. **Live concurrency verification against the Atlas-hosted replica set — the most important item in this feature.** Per Analysis Blueprint Phase 5 Q14 / Phase 13, this specifically needs verification "against the Atlas-hosted replica set, not just local dev" — a 3-node replica set has different commit-latency and network characteristics than the local single-node one, and this is the one place a subtle behavioral difference could hide. Re-run a scaled-down version of Feature 09/17's Part-A concurrency test (two near-simultaneous `/assign` calls competing for the same near-capacity user's remaining capacity) directly against the live Render-hosted backend and Atlas-hosted database. It does not need Feature 09's full 10-run rigor, but it must be run **more than once** (recommend 3 runs, matching Feature 17's own precedent for its combined test) and must explicitly confirm: exactly one success per run, no capacity overflow, and — if observable via logs — that the retry path was actually exercised at least once across the runs, not just that the final outcome happened to look correct.
5. **Transient-transaction-retry check, best-effort:** per Architecture Phase 20, attempt this "if feasible to trigger deliberately." Feature 17 already recorded this as not deterministically forceable at the integration level — if it's equally infeasible here, say so explicitly rather than silently skipping the line item (same standard Feature 17 held itself to).
6. **Cold-start behavior, documented not "fixed":** Render's free tier spins down an inactive service; the first request after idle will be slow. This was flagged in the blueprint as an open clarification question (Q9), never resolved with a definitive answer. Don't attempt to engineer around this (e.g., a keep-alive ping) unless explicitly asked — just observe and document the actual cold-start behavior you see, so the project owner/reviewer knows what to expect rather than being surprised by it.

## Step 6 — Close Feature 18's Follow-Up (README edit)

- In `README.md` **only**, replace:
  - The "Live URL" placeholder with the actual deployed Vercel frontend URL (and the Render backend URL if the README's structure calls for both — check Feature 18's actual written section rather than assuming).
  - The "Deployment" section's "planned, not yet executed" framing with an accurate, past-tense account of what was actually done — Atlas M0 setup, Render/Vercel deployment, the network-access choice made in Step 1 (and why), and a brief note of the Step 5 verification results (including the live concurrency check's outcome, since that's the single most reviewer-relevant fact this feature produces).
- Do not touch any other section of `README.md`, and do not touch `DECISIONS.md` at all.

---

## Acceptance Criteria

- [ ] MongoDB Atlas M0 cluster provisioned; network-access choice made and documented.
- [ ] `migrate-mongo up` and the seed script both run successfully against Atlas; seed idempotency reconfirmed.
- [ ] Backend deployed and reachable on Render; `/health` responds; all required env vars set including a real (non-wildcard) `CORS_ORIGIN`.
- [ ] Frontend deployed and reachable on Vercel; correctly configured to reach the Render backend.
- [ ] Duplicate-bid 409 smoke test passes in production.
- [ ] Live concurrency test run at least 3 times against the Atlas-hosted replica set, with results explicitly recorded (successes, overflow check, retry-path observation).
- [ ] Cold-start behavior observed and documented, not silently ignored and not "fixed" without being asked.
- [ ] `README.md`'s Live URL and Deployment sections updated to reflect actual, verified production state — no other file touched.
- [ ] Stability-over-time (the blueprint's "≥2 weeks" requirement) is explicitly flagged in your report as an ongoing condition this single deployment pass cannot itself certify — see Report Back.

## Self-Test Checklist (do this before reporting ready)

1. From a machine/browser with no special access (not your own dev environment's cached state), load the live Vercel URL cold and confirm the app loads and the task board populates from the live backend.
2. Run the full task lifecycle smoke test end-to-end via the live UI.
3. Run the duplicate-bid smoke test via Swagger UI against the live backend.
4. Run the live concurrency test 3 times, recording each run's outcome (success/failure, capacity numbers before/after, whether a retry was observed).
5. Deliberately let the Render service go idle, then hit it cold, and record the observed cold-start latency.
6. Diff `README.md` to confirm only the Live URL and Deployment sections changed.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm:
- The live URLs (frontend and backend).
- The Atlas network-access choice and its stated justification.
- The exact outcome of each of the 3 (or more) live concurrency test runs — this is the one result the project owner will care about most from this entire feature.
- The observed cold-start behavior, stated as an observation, not a resolved/fixed item.
- That the ≥2-week stability requirement from Analysis Blueprint Phase 3 is **not** something this single report can certify — flag it plainly as an ongoing condition the project owner should monitor, not a checkbox this feature can tick on its own.
- That `README.md` was the only file edited, and only its two flagged sections.
