# Feature 01 — Project Setup

**Status:** NOT STARTED
**Blueprint references:** Architecture Blueprint Phase 1 (#10, #11), Phase 2 (Technology Stack), Phase 3 (Folder Structure)

---

## Goal

Stand up the repo skeleton, local MongoDB replica set via Docker Compose, and base env configuration for both backend and frontend — nothing functional yet, just a scaffold that runs and connects.

## Scope (this feature ONLY)

- Root repo structure per Architecture Blueprint Phase 3.
- `docker-compose.yml` running a **single-node MongoDB replica set** (required for transactions later — do not skip the replica-set init, a plain `mongo` container will silently break Feature 09).
- `backend/` — Node.js + Express skeleton, JavaScript only, connects to MongoDB via Mongoose, one health-check route.
- `frontend/` — Vite + React (JS template, not TS), default starter page.
- `.env.example` at both `backend/` and root level as appropriate.
- `.gitignore` covering `node_modules`, `.env`, build output.
- ESLint + Prettier config, JS-only (no typescript-eslint).

## Explicitly OUT of scope for this feature
- No Mongoose schemas/models yet (Feature 02).
- No real API endpoints beyond `/health` (later features).
- No frontend routing/pages beyond the default Vite starter (Feature 12).
- No deployment config (Feature 19).

---

## Step-by-Step Instructions

1. **Root structure** — create exactly the folder layout from Architecture Blueprint Phase 3 (backend/src/..., frontend/src/..., docs/ already exists from the architect).

2. **Docker Compose — MongoDB replica set:**
   - Single `mongo` service, image `mongo:7`.
   - Command must launch `mongod` with `--replSet rs0`.
   - After container starts, replica set must be initiated (`rs.initiate()`) — this can be done via a Compose healthcheck + a one-off init script/command, or documented as a manual one-time step run after `docker-compose up`. Pick the approach that's most reliable to reproduce, and document exactly which one you chose and the exact command in your report.
   - Expose on the standard Mongo port, persist data via a named volume.

3. **Backend skeleton:**
   - `package.json` with: `express`, `mongoose`, `dotenv`, `cors`, `helmet`, plain JS — no TypeScript packages.
   - `src/app.js` — Express app assembly (middleware: `cors`, `helmet`, `express.json()`).
   - `src/server.js` — bootstraps DB connection then starts the HTTP server.
   - `src/db/connection.js` — Mongoose connection singleton, reads `MONGODB_URI` from env, fails fast with a clear error if the var is missing (per Architecture Blueprint Phase 6's "config fails fast" principle).
   - `src/config/index.js` — loads/validates env vars.
   - One route: `GET /health` → `200 { status: "ok" }` once DB is connected; `503` if DB is not connected. (This is the inferred health-check endpoint from Architecture Blueprint Phase 20 — build it now since everything else depends on a working connection.)
   - `.env.example`: `MONGODB_URI`, `PORT`, `CORS_ORIGIN`, `NODE_ENV`.

4. **Frontend skeleton:**
   - Vite React (JavaScript template — `npm create vite@latest frontend -- --template react`, not `react-ts`).
   - Default starter page is fine as-is for this feature.
   - `.env.example`: `VITE_API_URL`.

5. **Linting/formatting:**
   - ESLint flat config, JS rules only.
   - Prettier config, applied to both `backend/` and `frontend/`.

6. **Root `.gitignore`:** `node_modules/`, `.env`, `dist/`, `build/`, `.DS_Store`.

---

## Acceptance Criteria

- [ ] `docker-compose up` brings up a MongoDB instance running as an initiated replica set (verify via `mongosh` → `rs.status()` shows `ok: 1`).
- [ ] Backend starts (`npm run dev` or equivalent inside `backend/`), connects to MongoDB successfully, logs a clear "connected" message.
- [ ] `GET /health` returns `200 { status: "ok" }` while the DB is up.
- [ ] Stopping the DB container and hitting `/health` again returns a `503`, not a crash.
- [ ] Frontend starts (`npm run dev` inside `frontend/`) and serves the default Vite React page.
- [ ] No `.ts`/`.tsx` files anywhere in the repo.
- [ ] No `.env` file committed; `.env.example` exists and lists every var actually used.

## Self-Test Checklist (do this before reporting ready)

1. Fresh clone simulation: delete `node_modules`, run install from scratch in both `backend/` and `frontend/`, confirm no missing-dependency errors.
2. `docker-compose down -v` then `docker-compose up` from a clean state — confirm the replica set initiates correctly every time, not just the first time (this matters, since Feature 09's transactions depend on it working reliably on repeated setups, e.g., a reviewer running this fresh).
3. Hit `/health` with the DB up, then with the DB stopped — confirm both responses.
4. Confirm ESLint runs clean (`npx eslint .`) in both folders.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. Explicitly state in **CURRENT STATE** whether the replica-set initiation is automatic (part of `docker-compose up`) or requires a manual one-time command — this detail must also be ready to go into the README later (Feature 18), so state it precisely now.
