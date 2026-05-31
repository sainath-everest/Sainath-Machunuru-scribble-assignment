# Quickstart & Validation: Room Setup & Lobby

**Feature**: `001-room-setup-lobby`
**Date**: 2026-06-01

Use this guide to manually verify all acceptance criteria after implementation.
Two browser tabs (Tab A = host, Tab B = joiner) are required for multi-player scenarios.

---

## Prerequisites

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev
# Confirm: "Backend listening on http://localhost:3001"

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
# Confirm: Vite dev server running on http://localhost:5173
```

---

## Step 1 — Health Check

```bash
curl http://localhost:3001/health
# Expected: {"ok":true}
```

---

## Step 2 — Create Room (US1 + FR-001, FR-002, SC-001)

**Tab A**:
1. Open `http://localhost:5173`
2. Click **Create Room**
3. Leave player name blank → click **Create and Continue**
   - ✅ Inline error appears; no navigation occurs (FR-002)
4. Type only spaces → click **Create and Continue**
   - ✅ Inline error appears (FR-002, Principle V)
5. Enter `Alice` → click **Create and Continue**
   - ✅ Lobby screen loads
   - ✅ Room code badge is displayed (4 characters, e.g. `ABCD`)
   - ✅ Participant list shows `Alice` with a **Host** label (FR-001, FR-009)
   - ✅ Start Game button is **disabled** with a "need more players" message (FR-011)

---

## Step 3 — Join Room Validation (US2 + FR-003, FR-004, FR-005, SC-004)

**Tab B**:
1. Open `http://localhost:5173` → click **Join Room**
2. Leave both fields blank → click **Join Lobby**
   - ✅ Inline error for empty name (FR-003)
3. Enter name `Bob`, leave room code blank → submit
   - ✅ Inline error for empty code (FR-004)
4. Enter name `Bob`, room code `ZZZZ` (invalid) → submit
   - ✅ Error message "Room not found" (or equivalent) displayed (FR-005)
   - ✅ User remains on Join screen; entered data not cleared (SC-004)
5. Enter name `Bob`, room code from Step 2 (lowercase accepted) → submit
   - ✅ Lobby screen loads for Tab B (FR-006)
   - ✅ Participant list shows `Bob` (no Host label)

---

## Step 4 — Lobby Auto-Polling (US3 + FR-007, FR-008, SC-002)

1. In **Tab A** lobby, do NOT click anything
2. In **Tab B**, complete Step 3 step 5 (join the room)
3. Watch **Tab A** for ≤3 seconds
   - ✅ `Bob` appears in Tab A's participant list automatically (SC-002)
   - ✅ No manual button press was required (FR-007)
4. Open browser DevTools → Network tab in Tab A
   - ✅ Confirm `GET /rooms/ABCD` requests fire approximately every 2 seconds (FR-007)
5. Navigate Tab A away from `/lobby` (click Back or navigate to `/`)
   - ✅ Network requests for room polling stop (FR-008)

---

## Step 5 — Host-Only Start Game + 2-Player Minimum (US4 + FR-010, FR-011, FR-012, SC-003)

1. With Tab A (host) and Tab B (Bob) both in the lobby:
   - In **Tab B** (non-host): Start Game button is hidden or permanently disabled (FR-010)
   - In **Tab A** (host, 2 participants): Start Game button is **enabled** (FR-012)
2. Remove Bob: restart Tab B browser session so the backend still has both participants.
   *(Or test with a fresh room where only Alice has joined)*
   - With 1 participant only: Start Game button in Tab A is **disabled** (FR-011, SC-003)
3. Re-join with Bob → Start Game re-enables in Tab A
4. Click **Start Game** in Tab A
   - ✅ Tab A navigates to `/game` (US4 acceptance scenario 4)
   - ✅ Tab B remains on `/lobby` (non-host navigation to the game screen is not in Scenario 1 scope)

---

## Step 6 — Room Isolation (US5 + FR-013, SC-005)

1. **Tab A**: Create Room → note code `ROOM1`
2. **Tab C** (new tab): Create Room → note code `ROOM2`
3. **Tab B**: Join `ROOM1` as `Bob`
4. In Tab A's lobby: ✅ Only `Alice` and `Bob` visible
5. In Tab C's lobby: ✅ Only Tab C's creator visible; `Bob` does NOT appear (SC-005)

---

## Step 7 — Direct URL Guard (FR-014)

1. Open a fresh tab, navigate directly to `http://localhost:5173/lobby`
   - ✅ Redirected to Start screen (`/`)
2. Navigate directly to `http://localhost:5173/game`
   - ✅ Redirected to Start screen (`/`)

---

## Step 8 — Polling Error Resilience (FR-015, Edge Case)

1. With Tab A in the lobby and polling active, stop the backend (`Ctrl+C` in Terminal 1)
2. Watch Tab A for 2–3 poll cycles
   - ✅ Lobby stays on screen (no redirect)
   - ✅ Non-fatal error indicator appears (e.g. "Unable to refresh room")
3. Restart the backend
   - ✅ Next poll succeeds; error indicator clears; polling continues at same ~2s cadence

---

## Step 9 — Build Gate (Constitution Development Workflow step 5)

```bash
cd backend && npm run build
# Expected: exits 0, no TypeScript errors

cd ../frontend && npm run build
# Expected: exits 0, no TypeScript errors
```

---

## Step 10 — Unit Tests

```bash
cd backend && npm test
# Expected: all tests pass (schemas + roomStore)

cd ../frontend && npm test
# Expected: all tests pass (api service)
```
