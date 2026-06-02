# Manual Validation Guide: Result, Restart & Final Validation

**Feature**: `004-result-restart-validation` | **Date**: 2026-06-02

This guide covers all acceptance scenarios for Scenario 4. Run after both builds are green.
Requires two browser tabs. Steps 1–5 set up the pre-condition; steps 6–17 validate Scenario 4.

---

## Setup

```bash
cd backend && npm run dev      # Tab A terminal — http://localhost:3001
cd frontend && npm run dev     # Tab B terminal — http://localhost:5173
```

Open two browser tabs: **Tab A** (host) and **Tab B** (guesser).

---

## Step 1 — Create room (Tab A)

1. Open `http://localhost:5173` in Tab A.
2. Click **Create Room** and enter name `Alice`.
3. Confirm you land on the Lobby screen.
4. Note the 4-character room code shown in the header.

**Expected**: Room code displayed. Alice is the only participant. "Start Game" button visible.

---

## Step 2 — Join room (Tab B)

1. Open `http://localhost:5173` in Tab B.
2. Click **Join Room**, enter the code from Step 1, enter name `Bob`.
3. Confirm you land on the Lobby screen.

**Expected**: Bob sees the lobby. Tab A (Alice) sees Bob appear within ~2s via polling.

---

## Step 3 — Start game (Tab A)

1. In Tab A, click **Start Game**.
2. Both tabs navigate to the Game screen.

**Expected**: Tab A shows "Draw the Word!" and a secret word banner. Tab B shows "Guess the Word!".

---

## Step 4 — Submit a correct guess (Tab B)

1. In Tab B, type the secret word (visible in Tab A's banner) into the guess field.
2. Submit the guess.

**Expected**: Guess history shows Bob's correct guess (✓). Bob's score updates to 100 in
the scoreboard. Tab A sees the same history and score within ~2s.

---

## Step 5 — Submit an incorrect guess (Tab B)

1. In Tab B, submit any word that is not the secret word.

**Expected**: Guess history adds another entry marked ✗. Bob's score remains 100.

---

## Step 6 — Verify End Round button visibility (FR-020 / US1-6)

1. Inspect Tab A (Alice = host). Confirm the **End Round** button is visible.
2. Inspect Tab B (Bob = non-host). Confirm the **End Round** button is NOT rendered.

**Expected**: Only Tab A shows the End Round button.

---

## Step 7 — End the round (Tab A)

1. In Tab A, click **End Round**.

**Expected**: Tab A transitions to the result screen immediately (no reload). The game layout
disappears; the result screen shows the secret word prominently.

---

## Step 8 — Non-host result screen appears via polling (Tab B) — SC-001

1. Without touching Tab B, wait up to ~2 seconds.

**Expected**: Tab B automatically transitions to the result screen without a page reload or
any user action.

---

## Step 9 — Secret word visible to all (SC-002 / US2-1)

1. On Tab A (Alice = drawer), confirm the secret word is prominently displayed.
2. On Tab B (Bob = guesser), confirm the same secret word is displayed.

**Expected**: Both tabs show the same word. This is the key visibility change from gameplay
(where only the drawer saw the word).

---

## Step 10 — Final scores correct (SC-003 / US2-2)

1. On both tabs, inspect the scoreboard.
2. Confirm Bob's score is 100. Confirm Alice's score is 0 (drawer cannot score).
3. Confirm scores are sorted descending (Bob first with 100, Alice second with 0).
4. Confirm no "Winner" label or badge is shown on any participant's row.

**Expected**: Scores match gameplay state. Neutral display — no winner designation.

---

## Step 11 — Full guess history displayed (SC-004 / US2-3 / US2-5)

1. On both tabs, inspect the guess history panel.
2. Confirm all guesses submitted in Steps 4–5 appear in chronological order.
3. Confirm each entry shows participant name ("Bob"), guess text, and a correct/incorrect
   indicator.
4. Confirm the correct guess (Step 4) has a distinct visual indicator (e.g., different color
   or ✓).

**Expected**: Both entries present. Correct guess visually distinguished.

---

## Step 12 — Canvas NOT shown on result screen (FR-009a / US2-6)

1. On both tabs, confirm no canvas drawing is rendered anywhere on the result screen.

**Expected**: Only three UI sections visible: secret word, scoreboard, guess history.

---

## Step 13 — Restart button visibility (FR-017)

1. On Tab A (host), confirm the **Restart** button is visible and enabled.
2. On Tab B (non-host), confirm the **Restart** button is NOT rendered (or is hidden).

**Expected**: Only Alice (host) sees and can interact with the Restart button.

---

## Step 14 — Guard: restart from non-result state (FR-012)

1. Open the browser DevTools console on either tab.
2. Send `POST http://localhost:3001/rooms/<code>/restart` with
   `{ "participantId": "<alice-id>" }` while room is still in `"result"` state.
   This is to confirm the happy path works via API — skip if already confirmed in Step 15.
3. Separately, test the guard: try calling the restart endpoint when status is NOT `"result"`
   (e.g., from lobby after a restart has already completed).

**Expected**: Guard returns `409 { "message": "Round has not ended" }` when status ≠ `"result"`.

---

## Step 15 — Host triggers restart (SC-005 / US3-1 / FR-018)

1. In Tab A (host), click **Restart**.

**Expected**: Tab A immediately navigates to the Lobby screen (within one render cycle, not
waiting for the next poll).

---

## Step 16 — Non-host navigates to lobby via polling (SC-005 / US3-7 / FR-018a)

1. Without touching Tab B, wait up to ~2 seconds.

**Expected**: Tab B automatically navigates to the Lobby screen. No manual action required.

---

## Step 17 — Participant list preserved, round state cleared (SC-005 / SC-006 / US3-2 / US3-3)

1. On both Lobby screens, confirm Alice and Bob both appear in the participant list.
2. Confirm there is no secret word, drawer label, guess history, or score data visible
   anywhere on the lobby screen.
3. Call `GET http://localhost:3001/rooms/<code>/game` from DevTools.
4. Confirm it returns `409 { "message": "Game has not started yet" }`.

**Expected**: Both players in lobby, zero residual round data, game endpoint 409s cleanly.

---

## Step 18 — New game after restart follows Scenario 2 rules (SC-007 / US3-6)

1. In Tab A (host), click **Start Game** again.
2. Confirm a new round starts with fresh scores of 0 for all participants.
3. Confirm the canvas is blank, guess history is empty.
4. Confirm a drawer is assigned (may or may not be the same player as before).

**Expected**: Clean slate — Scenario 2 rules apply exactly as before.

---

## Error Scenario Quick Checks

Run these via DevTools or curl to confirm guard behavior:

| Scenario | Endpoint | Expected |
|---|---|---|
| Non-host tries to end round | `POST /rooms/:code/end` with Bob's `participantId` | `403 "Only the host can end the round"` |
| End round when status is `"lobby"` | `POST /rooms/:code/end` with Alice's id | `409 "Round is not active"` |
| Non-host tries to restart | `POST /rooms/:code/restart` with Bob's `participantId` | `403 "Only the host can restart"` |
| Restart when status is `"playing"` | `POST /rooms/:code/restart` with Alice's id | `409 "Round has not ended"` |
| Submit guess during result state | `POST /rooms/:code/guess` with any `participantId` | `409 "Game has not started yet"` |
| Unknown room code | Any Scenario 4 endpoint | `404 "Room not found"` |
