# Quickstart: Game Start Transition Validation

**Feature**: 002-game-start-transition
**Date**: 2026-06-01

**Prerequisites**: Scenario 1 fully working — two players can create/join a room and see each other in the lobby.

---

## Start Both Servers

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

---

## Step 1 — Create a Room (Tab A — Host)

1. Open `http://localhost:5173` in Tab A.
2. Enter player name **"Alice"**, click **Create Room**.
3. Note the 4-character room code shown in the lobby (e.g. `XKJP`).
4. Confirm "Host" badge appears next to Alice.
5. Confirm "Start Game" button is **disabled** (only 1 player).

---

## Step 2 — Join the Room (Tab B — Second Player)

1. Open `http://localhost:5173` in Tab B.
2. Click **Join Room**, enter name **"Bob"** and the room code from Step 1.
3. Confirm Bob lands in the lobby.
4. In Tab A, confirm Bob's name appears in the participant list within ~2s (auto-poll).
5. Confirm "Start Game" button in Tab A is now **enabled**.

---

## Step 3 — Start the Game (Host Action)

1. In Tab A, click **Start Game**.
2. Confirm Tab A immediately navigates to `/game`.
3. Confirm Tab B automatically navigates to `/game` within ~2s (next poll cycle).

**Server-side check** (optional `curl`):
```bash
curl http://localhost:3001/rooms/XKJP
# Expected: "status": "playing"
# Expected: no "drawerId" or "secretWord" in the response
```

---

## Step 4 — Verify Drawer View (Tab A — Alice is drawer)

1. In Tab A, confirm a **"Secret word"** banner is visible showing the word (e.g. "rocket").
2. Confirm Alice's role shown as "Drawer".
3. Confirm the game screen shows the canvas area.

**API check**:
```bash
curl "http://localhost:3001/rooms/XKJP/game?participantId=<alice-participantId>"
# Expected: "secretWord": "rocket" (or whichever word was selected)
# Expected: "drawerId" matches Alice's participantId
```

---

## Step 5 — Verify Guesser View (Tab B — Bob is guesser)

1. In Tab B, confirm **no "Secret word"** banner is visible.
2. Confirm Bob's role shown as "Guesser".
3. Confirm the guess input area is visible.

**API check**:
```bash
curl "http://localhost:3001/rooms/XKJP/game?participantId=<bob-participantId>"
# Expected: response does NOT contain "secretWord" field at all
# Expected: "drawerId" matches Alice's participantId
```

---

## Step 6 — Verify `secretWord` Isolation

```bash
# Attempt to access game state without participantId
curl "http://localhost:3001/rooms/XKJP/game"
# Expected: response does NOT contain "secretWord" — treated as guesser view

# Attempt to access with a random/unknown participantId
curl "http://localhost:3001/rooms/XKJP/game?participantId=00000000-0000-0000-0000-000000000000"
# Expected: response does NOT contain "secretWord"
```

---

## Step 7 — Verify Host-Only Start Guard

```bash
# Attempt to start with Bob's participantId (non-host)
curl -X POST http://localhost:3001/rooms/XKJP/start \
  -H "Content-Type: application/json" \
  -d '{"participantId":"<bob-participantId>"}'
# Expected: 403 Forbidden — "Only the host can start the game"

# Attempt to start with no participantId
curl -X POST http://localhost:3001/rooms/XKJP/start \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 403 Forbidden (or 400 from Zod validation)
```

---

## Step 8 — Verify Double-Start Guard

```bash
# Attempt to start a game that is already playing
curl -X POST http://localhost:3001/rooms/XKJP/start \
  -H "Content-Type: application/json" \
  -d '{"participantId":"<alice-participantId>"}'
# Expected: 409 Conflict — "Game already started"
```

---

## Step 9 — Verify Minimum Player Guard

1. Create a new room (single player only — do not join with Tab B).
2. Try to start:
```bash
curl -X POST http://localhost:3001/rooms/NEWC/start \
  -H "Content-Type: application/json" \
  -d '{"participantId":"<host-participantId>"}'
# Expected: 400 Bad Request — "Need at least 2 players to start"
```

---

## Step 10 — Verify Scenario 1 Non-Regression

1. Open a fresh browser window (not Tab A or B).
2. Create a new room and join with a second player.
3. Confirm lobby still works exactly as before — polling, Host badge, Start Game gating.
4. Confirm `GET /rooms/:code` for a lobby room still returns `"status": "lobby"` and no game fields.

---

## Acceptance Checklist

- [ ] Tab A → `/game` immediately on Start Game click
- [ ] Tab B → `/game` within ~2s of host starting
- [ ] Drawer (Tab A) sees `secretWord` banner
- [ ] Guesser (Tab B) does NOT see `secretWord` — field absent in API response
- [ ] `GET /rooms/:code/game` without `participantId` — no `secretWord`
- [ ] Non-host `POST /rooms/:code/start` → 403
- [ ] Already-started `POST /rooms/:code/start` → 409
- [ ] 1-player `POST /rooms/:code/start` → 400
- [ ] `GET /rooms/:code` still works during `"playing"` — returns `status: "playing"`, no game fields
- [ ] Scenario 1 lobby flows still work end-to-end
