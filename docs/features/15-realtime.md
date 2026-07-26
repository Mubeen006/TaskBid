# Feature 15 — Realtime Layer (Socket.IO)

**Status:** NOT STARTED
**Depends on:** Feature 07 (Bids Module), Feature 09 (Assignment Engine), Feature 14 (Task Detail Page) must be TESTED — READY FOR COMMIT before starting this.
**Blueprint references:** Architecture Blueprint Phase 12 (Realtime Architecture — read this in full before starting)

---

## Goal

When a new bid is placed on a task another user is currently viewing, that user's bid list updates without a page refresh. Room-per-task Socket.IO, with reconnect handling for the production cold-start scenario the Architecture Blueprint specifically calls out.

## Scope (this feature ONLY)

- Backend: `backend/src/realtime/socket.js` (Socket.IO server setup, room join/leave handlers), `backend/src/realtime/events.js` (event name constants), wiring into `server.js` (Socket.IO needs the raw HTTP server instance, not just the Express app — this changes how `server.js` bootstraps slightly).
- Backend: emit `bid:created` after a successful bid creation (Feature 07's service), emit `task:assigned` after a successful assignment (Feature 09's service) — both to the `task:{id}` room.
- Frontend: `frontend/src/realtime/socket.js` (client singleton), a `useRealtimeBids(taskId)` hook that joins/leaves the task room and merges incoming events into the React Query cache.

## Explicitly OUT of scope for this feature
- No changes to the Task Board's data freshness — realtime updates are scoped to the Task Detail page's bid list only, per the original assignment's explicit requirement ("when a new bid is placed on a task that another user is viewing"). Live-updating the board view too is a reasonable stretch goal but not required — if you have time and want to add it, note it as an extra, don't let it block this feature's core scope.
- No new backend business logic — this feature only adds broadcast side-effects to already-existing, already-tested service methods (Features 07/09). Do not modify what those services actually do beyond adding an emit call at the end of a successful operation.

---

## Backend Specification

**`realtime/events.js`:** export event name constants, e.g. `BID_CREATED = 'bid:created'`, `TASK_ASSIGNED = 'task:assigned'` — used by both the emitting code and (conceptually) documented for the frontend to match exactly; don't let event name strings be typed inline in multiple places.

**`realtime/socket.js`:** initialize Socket.IO attached to the raw HTTP server (not the Express app directly — `server.js` needs `const httpServer = http.createServer(app); const io = require('./realtime/socket')(httpServer);` or equivalent), configure CORS to match the existing `CORS_ORIGIN` env var. Handle a `join:task` event from clients (payload: `{ taskId }`) by adding that socket to room `task:{taskId}`; handle `leave:task` similarly, removing from the room.

**Wiring into Feature 07's `bids.service.js`:** after the bid-creation transaction/operation commits successfully, emit `BID_CREATED` to room `task:{taskId}` with the new bid's data (enough for the frontend to insert it into the list without a refetch — id, user info, hoursOffered, status, createdAt).

**Wiring into Feature 09's `assignment.service.js`:** after a successful assignment commits, emit `TASK_ASSIGNED` to room `task:{taskId}` with the result (assignedUserId, assignedBidId, new task status).

**Important — don't let this coupling become awkward:** the Socket.IO server instance (`io`) needs to be accessible from within `bids.service.js` and `assignment.service.js` without creating a circular-require mess or tightly coupling business logic to transport details. A common clean pattern: `realtime/socket.js` exports both the initializer and a getter (e.g., `getIO()`) that any service can import and call after `server.js` has initialized it once at boot — use whatever pattern keeps this clean, but the services' core logic must not become harder to unit-test because of this addition (i.e., don't make the emit call impossible to skip/mock in isolation if that ever matters for future testing).

## Frontend Specification

**`realtime/socket.js`:** a singleton Socket.IO client instance, connecting to `VITE_SOCKET_URL`, created once at module load (not per-component), reused across the whole app.

**`useRealtimeBids(taskId)` hook:** on mount, emits `join:task` with the current `taskId`; on unmount, emits `leave:task`. Listens for `bid:created` events matching this task and, on receipt, updates the React Query cache directly (`queryClient.setQueryData(['bids', taskId], ...)` — insert the new bid in the correct sorted position, per Architecture Blueprint Phase 12's guidance, rather than triggering a full refetch, for faster perceived responsiveness) — also listens for `task:assigned` and invalidates/refetches the task query so the Task Detail page's status/assignment display updates too.

**Reconnect handling:** on the client's `reconnect` event (Socket.IO's default reconnection is enabled out of the box — don't disable it), re-emit `join:task` for whatever task the user currently has open, and trigger a manual refetch of that task's bids to reconcile anything potentially missed while disconnected (per Architecture Blueprint Phase 12 — this closes the gap that a reconnected socket doesn't automatically know what it missed).

---

## Acceptance Criteria

- [ ] Opening the same task in two browser tabs (simulating two users via the switcher), placing a bid in one tab, causes the bid to appear in the other tab's list within a couple seconds, without a manual refresh.
- [ ] Triggering an assignment in one tab updates the task's displayed status in another tab that has the same task open.
- [ ] Navigating away from a Task Detail page correctly leaves that task's room (verify via a temporary server-side log showing room membership, or by confirming a bid placed on that task after navigating away doesn't cause any client-side error from a stale listener).
- [ ] Manually disconnecting and reconnecting (e.g., briefly stopping the backend process and restarting it while a Task Detail page is open) results in the client reconnecting and its bid list being correctly reconciled, not stuck showing stale data.
- [ ] The Task Board page (Feature 13) is unaffected by this feature — no requirement was added there, and it should not have silently gained or lost any behavior.

## Self-Test Checklist (do this before reporting ready)

1. Two-tab manual test: place a bid in tab A, confirm it appears in tab B within a few seconds, for a task both tabs have open.
2. Two-tab manual test: trigger an assignment in tab A (on a `bidding_closed` task), confirm tab B's view of that same task updates.
3. Navigate tab B away from the task detail page, place another bid via tab A or a script, then navigate tab B back to the same task and confirm the bid list is correct (this proves the room leave/rejoin cycle works, not just a single long-lived connection).
4. Restart the backend process while a Task Detail page is open in a browser tab; confirm the client reconnects (Socket.IO's default behavior) and a stale-data indicator or automatic refetch brings the view back in sync.

## Report Back

Use the standard reporting format from `MASTER_PROMPT.md`. In **CURRENT STATE**, explicitly confirm: the pattern used to give `bids.service.js`/`assignment.service.js` access to the `io` instance without circular requires, and that the reconnect-and-reconcile behavior was actually tested (backend genuinely restarted mid-session), not just assumed from Socket.IO's default reconnection working in principle.
