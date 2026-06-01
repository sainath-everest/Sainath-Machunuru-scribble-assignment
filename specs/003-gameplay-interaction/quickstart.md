# Quickstart: Scenario 3 Manual Validation

Use two browser tabs (Tab A = drawer, Tab B = guesser) against a running
`npm run dev` backend and frontend.

**Prerequisites**: Scenario 2 is complete. You have a room in `"playing"` status from
a previous session, or you will run Steps 1–2 to create one.

---

## Setup (Steps 1–2)

### Step 1 — Create a room and start the game

```bash
# Create room (Tab A — host/drawer)
curl -s -X POST http://localhost:3001/rooms \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Alice"}' | jq .
# Note participantId (ALICE_ID) and room.code (CODE)

# Join room (Tab B — guesser)
curl -s -X POST http://localhost:3001/rooms/CODE/join \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Bob"}' | jq .
# Note participantId (BOB_ID)

# Start game (Alice = host)
curl -s -X POST http://localhost:3001/rooms/CODE/start \
  -H "Content-Type: application/json" \
  -d '{"participantId": "ALICE_ID"}' | jq .
# Confirm status: "playing"
```

### Step 2 — Confirm baseline game state

```bash
curl -s "http://localhost:3001/rooms/CODE/game?participantId=ALICE_ID" | jq .
# Confirm: strokes: [], guesses: [], scores: { ALICE_ID: 0, BOB_ID: 0 }
# Confirm: secretWord is present (Alice is drawer)

curl -s "http://localhost:3001/rooms/CODE/game?participantId=BOB_ID" | jq .
# Confirm: strokes: [], guesses: [], scores: { ALICE_ID: 0, BOB_ID: 0 }
# Confirm: secretWord is ABSENT (Bob is guesser)
```

---

## Canvas Drawing (Steps 3–6)

### Step 3 — Drawer submits a stroke

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/canvas/stroke \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "ALICE_ID",
    "points": [{"x":10,"y":20},{"x":20,"y":30},{"x":30,"y":40}]
  }' | jq .
# Confirm: game.strokes has 1 entry; game.secretWord present (drawer view)
```

### Step 4 — Guesser polls and sees the stroke

```bash
curl -s "http://localhost:3001/rooms/CODE/game?participantId=BOB_ID" | jq .
# Confirm: strokes[0] has the 3 points from Step 3
# Confirm: secretWord is ABSENT
```

### Step 5 — Non-drawer cannot submit strokes (403 guard)

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/canvas/stroke \
  -H "Content-Type: application/json" \
  -d '{"participantId": "BOB_ID", "points": [{"x":1,"y":1}]}' | jq .
# Expect: 403 "Only the drawer can modify the canvas"
```

### Step 6 — Drawer clears the canvas

```bash
curl -s -X DELETE http://localhost:3001/rooms/CODE/canvas \
  -H "Content-Type: application/json" \
  -d '{"participantId": "ALICE_ID"}' | jq .
# Confirm: game.strokes: []

curl -s "http://localhost:3001/rooms/CODE/game?participantId=BOB_ID" | jq .
# Confirm: strokes: [] (canvas cleared for guessers too)
```

---

## Guess Submission (Steps 7–10)

### Step 7 — Empty guess rejected (client-side first, then server-side)

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "BOB_ID", "text": "   "}' | jq .
# Expect: 400 "Guess cannot be empty"
```

### Step 8 — Incorrect guess accepted, score unchanged

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "BOB_ID", "text": "rocket"}' | jq .
# Confirm: game.guesses[0].correct = false
# Confirm: game.scores.BOB_ID = 0 (unchanged)
```

### Step 9 — Correct guess (case-insensitive) scores 100

```bash
# Replace WORD with whatever secretWord was assigned (from Step 2 with Alice's ID)
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "BOB_ID", "text": "WORD_IN_UPPER_CASE"}' | jq .
# Confirm: game.guesses last entry correct = true
# Confirm: game.scores.BOB_ID = 100
# Confirm: secretWord ABSENT (guesser view)
```

### Step 10 — Second correct guess: recorded but no additional score

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "BOB_ID", "text": "WORD_IN_UPPER_CASE"}' | jq .
# Confirm: game.guesses now has 3 entries; latest correct = true
# Confirm: game.scores.BOB_ID STILL = 100 (not 200)
```

---

## Guard Rails (Steps 11–13)

### Step 11 — Drawer cannot submit a guess (403)

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "ALICE_ID", "text": "pizza"}' | jq .
# Expect: 403 "Drawer cannot submit guesses"
```

### Step 12 — Unknown participantId on guess (404)

```bash
curl -s -X POST http://localhost:3001/rooms/CODE/guess \
  -H "Content-Type: application/json" \
  -d '{"participantId": "fake-id", "text": "pizza"}' | jq .
# Expect: 404 "Participant not found"
```

### Step 13 — Confirm all players see synced history via poll

```bash
# From Alice's (drawer's) perspective
curl -s "http://localhost:3001/rooms/CODE/game?participantId=ALICE_ID" | jq '.game.guesses'
# Confirm: all 3 guesses from Steps 8–10 are present
# Confirm: secretWord IS present for Alice

curl -s "http://localhost:3001/rooms/CODE/game?participantId=BOB_ID" | jq '.game.guesses'
# Confirm: same 3 guesses
# Confirm: secretWord is ABSENT for Bob
```

---

## Browser Validation (Step 14)

1. Start both servers (`npm run dev` in `backend/` and `frontend/`).
2. Open Tab A as the drawer: draw strokes on the canvas; confirm they render.
3. Open Tab B as the guesser: wait for the next poll (~2s); confirm strokes appear.
4. Click "Clear Canvas" in Tab A; wait one poll on Tab B; confirm canvas is blank.
5. Submit a guess in Tab B; confirm the scoreboard updates immediately in Tab B.
6. Wait ~2s; confirm the scoreboard also updates in Tab A.
7. Verify the guess form is not visible in Tab A (drawer role).
8. Verify the secret word banner is visible only in Tab A.
