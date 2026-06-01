# Feature Specification: Gameplay Interaction

**Feature Branch**: `003-gameplay-interaction`

**Created**: 2026-06-01

**Status**: Draft

**Scenario**: Scenario 3 — Gameplay Interaction

---

## Context

This feature builds strictly on Scenario 2. A round is already active: the room is in
`"playing"` status, one participant is the drawer, and a `secretWord` is set server-side.
Scenario 3 adds the interactive gameplay layer: the drawer uses an HTML5 canvas to draw;
guessers submit text guesses that are trimmed, case-insensitively matched, and scored; all
players see the shared guess history and scoreboard via polling.

No Scenario 1 or Scenario 2 behavior is modified. No Scenario 4 logic (result screen,
end-of-round state, restart) is introduced.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Drawer Draws and Clears the Canvas (Priority: P1)

The assigned drawer sees an interactive HTML5 canvas on the game screen. They can draw
freehand strokes and clear the entire canvas at any time to start over.

**Why this priority**: The canvas is the drawer's primary interaction surface and the
visual medium guessers respond to. All other Scenario 3 mechanics depend on a functional canvas.

**Independent Test**: Log in as the drawer. Confirm the canvas accepts pointer input and
renders visible strokes. Complete a stroke (pen-lift) and confirm a `POST /rooms/:code/canvas/stroke`
request is sent. Click "Clear Canvas" and confirm a `DELETE /rooms/:code/canvas` request is
sent. On a second tab as a guesser, poll `GET /rooms/:code/game` and confirm the strokes
appear; after clear, confirm the strokes array is empty.

**Acceptance Scenarios**:

1. **Given** the active round's drawer is viewing the game screen, **When** they press the
   pointer and drag on the canvas, **Then** a continuous freehand stroke is rendered at the
   correct position on the drawer's canvas.
2. **Given** a stroke is completed (pen-lift), **When** the drawer's canvas submits it,
   **Then** the stroke is sent to `POST /rooms/:code/canvas/stroke` and appended to the
   server-side `currentRound.strokes` array.
3. **Given** strokes exist server-side, **When** the drawer clicks "Clear Canvas", **Then**
   `DELETE /rooms/:code/canvas` is called, the server empties `currentRound.strokes`, and
   all strokes are removed from the drawer's canvas immediately.
4. **Given** strokes are stored server-side, **When** a guesser polls `GET /rooms/:code/game`,
   **Then** their canvas re-renders the current `strokes` array reflecting the drawer's
   drawing within ~2s; an empty strokes array results in a blank canvas.
5. **Given** a guesser is on the game screen, **When** they attempt to draw, **Then** the
   canvas input is disabled — only the assigned drawer can produce strokes.

---

### User Story 2 — Guesser Submits a Validated Guess (Priority: P1)

A guesser types a guess and submits it. The system trims whitespace, rejects empty guesses,
and compares the cleaned text case-insensitively to the secret word. The result is immediately
recorded and the guesser's score is updated.

**Why this priority**: Guess submission is the guessers' sole gameplay action. Validation and
scoring all depend on this flow working correctly.

**Independent Test**: As a guesser, submit an empty guess — confirm a client-side error
message appears and nothing is sent to the server. Submit "  PIZZA  " when the secret word is
"pizza" — confirm the guess is accepted as correct and the score changes to 100. Submit
"wrong" — confirm the score stays at 100.

**Acceptance Scenarios**:

1. **Given** a guesser types nothing or only whitespace into the guess field, **When** they
   submit the form, **Then** the guess is rejected client-side with a visible error message
   ("Guess cannot be empty") and is not sent to the server.
2. **Given** a guesser submits a non-empty guess, **When** the server processes it, **Then**
   the submitted text is trimmed and the comparison to the secret word is case-insensitive
   (e.g., "PIZZA", "pizza", "  Pizza  " all match "pizza").
3. **Given** the trimmed, lowercased guess matches the secret word, **When** the server
   processes it, **Then** that participant's score is incremented by 100.
4. **Given** the trimmed, lowercased guess does NOT match the secret word, **When** the server
   processes it, **Then** the participant's score is unchanged (0 points added).
5. **Given** the drawer is on the game screen, **When** they view the game layout, **Then**
   the guess form is not rendered for them — drawers cannot submit guesses via the UI.
6. **Given** the drawer sends a `POST /rooms/:code/guess` request with their `participantId`,
   **When** the server processes it, **Then** the server returns `403 Forbidden` with the
   message "Drawer cannot submit guesses" — server-side enforcement is required, not UI-only.

---

### User Story 3 — Guess History Synced to All Players (Priority: P1)

Every accepted guess — correct or incorrect — is appended to the round's history and made
visible to all players (drawer and guessers) on their next poll cycle.

**Why this priority**: Shared history is the primary feedback mechanism that shows all players
what has been guessed and whether it was correct. It is critical for a coherent multiplayer
experience.

**Independent Test**: From two tabs (drawer and guesser), have the guesser submit 2 incorrect
guesses and 1 correct guess. On both tabs, confirm all 3 entries appear in the history within
one poll cycle (~2s). Confirm the correct one is marked differently from the incorrect ones.

**Acceptance Scenarios**:

1. **Given** a guess has been accepted by the server, **When** any participant polls
   `GET /rooms/:code/game`, **Then** the guess appears in the `guesses` array within ~2s.
2. **Given** the guess history contains entries, **When** any player views the history,
   **Then** each entry shows: the guesser's display name, the guess text, and a correct/incorrect
   indicator.
3. **Given** an incorrect guess is in the history, **When** the drawer views the history,
   **Then** the guess text is shown — the secret word is NOT revealed alongside it.
4. **Given** a correct guess is in the history, **When** any player views it, **Then** it is
   visually distinguished from incorrect guesses (e.g., different color or label).

---

### User Story 4 — Scoreboard Shows Live Scores (Priority: P2)

All participants' cumulative scores are displayed in the scoreboard. The board starts at all
zeros and updates within one poll cycle of each scoring event.

**Why this priority**: The scoreboard provides competitive feedback. It depends on US2 and US3
being functional.

**Independent Test**: At round start, confirm all scores are 0 on both tabs. After one correct
guess, confirm that guesser's score shows 100 on both tabs within ~2s.

**Acceptance Scenarios**:

1. **Given** a round has just started, **When** any player views the scoreboard, **Then** every
   participant's score is 0.
2. **Given** a participant submits a correct guess, **When** any player polls the game state,
   **Then** the scoreboard reflects that participant's updated score (100, or cumulative total
   if they have previously scored) within ~2s.
3. **Given** a participant has already scored 100 for a correct guess and submits the correct
   word again, **When** the server processes it, **Then** the entry is appended to guess
   history as `correct: true` but the participant's score is NOT incremented a second time —
   each participant may score 100 at most once per round.
4. **Given** the drawer is in the participant list, **When** the scoreboard is viewed, **Then**
   the drawer's score is listed as 0 and cannot be incremented via guessing.

---

### Edge Cases

- What happens when an empty or whitespace-only guess reaches the server? → The server MUST
  trim the text; if the result is empty, return `400 Bad Request: "Guess cannot be empty"`.
  Client-side validation prevents most of these before they leave the browser.
- What happens when two guessers simultaneously submit the same correct guess? → Both are
  processed independently; both receive 100 points. No duplicate-suppression logic exists.
- What if the `participantId` supplied with a guess does not match any known participant? →
  The server validates `participantId` against `room.participants` before processing the guess.
  If absent or unknown, the server returns `404 Not Found` with `"Participant not found"`.
  This prevents anonymous or fabricated IDs from affecting scores or history.
- What if the game is not yet in `"playing"` status and a guess arrives? → Server returns
  `409 Conflict: "Game has not started yet"`.
- What if the room code does not exist? → `404 Not Found`.
- What happens to accumulated scores and guess history if the server restarts? → All state is
  in-memory; a restart clears everything (accepted limitation per constitution).
- Can a guesser submit multiple guesses? → Yes; each submission is processed independently.
  Whether multiple *correct* guesses score each time is addressed in FR-017.

---

## Requirements *(mandatory)*

### Functional Requirements

**Canvas (FR-001 – FR-004)**

- **FR-001**: The game screen MUST render an HTML5 canvas element for drawing. When the
  viewing participant is the drawer, the canvas MUST accept pointer/mouse input and render
  freehand strokes. When the viewing participant is a guesser, the canvas input MUST be
  disabled.
- **FR-002**: The drawer MUST be provided a "Clear Canvas" control. Activating it MUST
  immediately remove all strokes from the canvas on the drawer's screen.
- **FR-003**: Drawing state MUST be stored server-side in `currentRound.strokes` as
  `Array<Array<{x: number, y: number}>>` — an outer array of strokes, each stroke an ordered
  array of `{x, y}` points. This array MUST be included in every `GET /rooms/:code/game`
  response so guessers can re-render the current drawing via polling.
- **FR-003a**: The system MUST expose `POST /rooms/:code/canvas/stroke` accepting
  `participantId` (string, required) and `points` (`Array<{x: number, y: number}>`, required)
  in the request body. On success the stroke is appended to `currentRound.strokes` and the
  endpoint returns `{ game: GameSnapshot }`.
- **FR-003b**: The system MUST expose `DELETE /rooms/:code/canvas` accepting `participantId`
  (string, required) in the request body. On success `currentRound.strokes` is set to `[]`
  and the endpoint returns `{ game: GameSnapshot }`.
- **FR-003c**: Both canvas endpoints MUST validate that `participantId` equals
  `currentRound.drawerId`; if not, return `403 Forbidden` with `"Only the drawer can modify
  the canvas"`.
- **FR-004**: Only the participant whose `participantId` matches `currentRound.drawerId` MAY
  produce strokes or trigger a clear. All other participants see the canvas as read-only.

**Guess Submission (FR-005 – FR-010)**

- **FR-005**: The system MUST expose a `POST /rooms/:code/guess` endpoint accepting
  `participantId` (string, required) and `text` (string, required) in the request body.
- **FR-006**: The server MUST trim leading and trailing whitespace from the submitted `text`
  before any validation or comparison.
- **FR-007**: If the trimmed `text` is empty, the server MUST return `400 Bad Request` with
  message `"Guess cannot be empty"`. The frontend MUST also prevent submission of an empty or
  whitespace-only guess and display an inline error message.
- **FR-008**: If the `participantId` matches `currentRound.drawerId`, the server MUST return
  `403 Forbidden` with message `"Drawer cannot submit guesses"`.
- **FR-008a**: The server MUST validate that `participantId` exists in `room.participants`;
  if absent or unknown, return `404 Not Found` with `"Participant not found"`.
- **FR-009**: The server MUST compare the trimmed, lowercased guess to the trimmed, lowercased
  `currentRound.secretWord`. A match is `correct: true`; otherwise `correct: false`.
  If `correct: true` AND `currentRound.scores[participantId] === 0`, increment the score by
  100. If the participant has already scored (score > 0), the guess is recorded as
  `correct: true` but the score is NOT incremented again — each participant scores at most
  once per round.
- **FR-010**: Every accepted guess (correct or incorrect) MUST be appended to
  `currentRound.guesses` as an entry containing at minimum: `participantId`, `text` (trimmed),
  and `correct` (boolean).

**Guess History & Scoring (FR-011 – FR-017)**

- **FR-011**: The `GET /rooms/:code/game` response MUST include `guesses: Guess[]` (full
  history) and `scores: Record<string, number>` (keyed by `participantId`) for all callers,
  regardless of drawer or guesser role.
- **FR-012**: All participant scores MUST be initialised to `0` when the round is created
  (at game start, in `startGame`).
- **FR-013**: The frontend scoreboard MUST render scores sourced from the `scores` field of
  the game state polling response.
- **FR-014**: The frontend guess history panel MUST render entries sourced from the `guesses`
  field of the game state polling response. Each entry MUST show the guesser's display name
  (resolved from the `participants` list), the guess text, and a correct/incorrect indicator.
- **FR-015**: The frontend MUST hide the guess form when the viewer is the drawer and display
  it only when the viewer is a guesser (derived from `game.drawerId === participantId`).
- **FR-016**: The game-screen polling interval MUST remain ~2s (established in Scenario 2).
  Guess history and scores are included in the same `GET /rooms/:code/game` response — no
  separate polling endpoint is needed.
- **FR-017**: Each participant's score increment for a correct guess is capped at one event
  per round. A second correct submission from the same participant is appended to history
  with `correct: true` but adds 0 to `currentRound.scores[participantId]`.
- **FR-018**: On a successful guess submission, `POST /rooms/:code/guess` MUST return
  `{ game: GameSnapshot }` containing the updated `scores`, `guesses`, and `strokes`. This
  allows the submitting guesser to see their result immediately without waiting for the next
  poll cycle.

### Key Entities

- **Guess**: A single guess record within a round.
  Attributes: `participantId` (string), `text` (string, trimmed), `correct` (boolean),
  `submittedAt` (ISO-8601 string).
- **Stroke**: An ordered array of `{x: number, y: number}` points representing one
  continuous pen-down-to-pen-up movement on the canvas.
- **Round** (extended from Scenario 2): Gains three new fields:
  - `strokes: Stroke[]` — append-only array of completed strokes; emptied on clear; starts `[]`
  - `guesses: Guess[]` — append-only history; starts `[]`
  - `scores: Record<string, number>` — keyed by `participantId`; all values start at `0`
- **GameSnapshot** (extended from Scenario 2): Gains `strokes: Stroke[]`, `guesses: Guess[]`,
  and `scores: Record<string, number>` in both drawer and guesser views. The `secretWord`
  field remains present only in the drawer's view (unchanged from Scenario 2).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A guesser can submit a correct guess with any casing and leading/trailing spaces
  and receive 100 points — score change confirmed in scoreboard within ~2s.
- **SC-002**: 100% of empty or whitespace-only guess submissions are rejected before reaching
  the server — an inline error message appears in the UI with no network request made.
- **SC-003**: All submitted guesses appear in the shared history for all players within one
  poll cycle (~2s) — no manual refresh required.
- **SC-004**: The drawer's score is 0 at all times during gameplay — the drawer cannot score
  points by submitting guesses (blocked at both UI and API level).
- **SC-005**: All participant scores are displayed as 0 at round start before any guesses are
  submitted, confirmed on every participant's screen.
- **SC-006**: Case-insensitive matching works in 100% of correct-guess submissions — "PIZZA",
  "pizza", "  Pizza  " all match "pizza" and score 100.
- **SC-007**: Two players can be on the game screen simultaneously, submit guesses, and both
  see each other's history entries within ~2s of each submission.

---

## Assumptions

- Scenario 2 is fully implemented: the room is in `"playing"` status, `currentRound` is set
  with `drawerId`, `secretWord`, and `roundNumber: 1`. The `GET /rooms/:code/game` endpoint
  exists and polls correctly.
- All scores are stored in-memory inside the `Round` object on the backend. No persistence
  across server restarts.
- A round never ends within Scenario 3 — there is no end-of-round trigger here. The round
  continues until Scenario 4 introduces result/restart logic.
- The `POST /rooms/:code/guess` endpoint validates that `participantId` exists in
  `room.participants` before processing. An unknown `participantId` returns `404 Not Found`.
  This is consistent with the game-rule integrity approach used throughout prior scenarios.
- Drawing canvas uses the standard HTML5 Canvas API with mouse/touch pointer events. No
  third-party drawing libraries are assumed.
- Display names in guess history are resolved client-side from `game.participants` (already
  in the `GameSnapshot`). No additional name-lookup endpoint is needed.
- Each guess entry is appended to `currentRound.guesses` in submission order. No sorting or
  deduplication is applied.
- The ~2s polling interval established in Scenario 2 is used unchanged. Guess history and
  scores are included in the existing `GET /rooms/:code/game` response — no new polling
  endpoint is introduced.

---

## Clarifications

### Session 2026-06-01

- Q: Should drawing strokes be stored server-side and synced to guessers via polling, or is the canvas local to the drawer only? → A: Strokes are stored server-side in `currentRound.strokes` and included in `GET /rooms/:code/game` so guessers see the current drawing update on each ~2s poll cycle.
- Q: How does the drawer's canvas state reach the server — per-point streaming, per-stroke on pen-lift, or batched? → A: One completed stroke is submitted to `POST /rooms/:code/canvas/stroke` on pen-lift; "Clear Canvas" calls `DELETE /rooms/:code/canvas` to empty the strokes array. Storage format is `Array<Array<{x: number, y: number}>>`.
- Q: Can the same guesser score 100 multiple times by submitting the correct word repeatedly, or is scoring capped at one event per guesser per round? → A: Capped at one scoring event per participant per round. A second correct submission is appended to history as `correct: true` but adds 0 to the score.
- Q: What does `POST /rooms/:code/guess` return on success — full game snapshot, minimal acknowledgment, or no body? → A: Returns `{ game: GameSnapshot }` with updated `scores`, `guesses`, and `strokes` so the guesser sees their result immediately without waiting for the next poll.
- Q: Should the server validate that `participantId` on a guess submission exists in `room.participants`, or accept any ID as long as it is not the drawer? → A: Server validates membership; returns `404 Not Found` with `"Participant not found"` for absent or unknown IDs.

---

## Non-Goals (Strict Scenario 3 Boundary)

- End-of-round detection or result screen — Scenario 4.
- Displaying the correct word to all players after round ends — Scenario 4.
- Restarting the game or returning to the lobby — Scenario 4.
- Multiple rounds or drawer rotation — explicitly out of scope for all scenarios (README).
- Timers, countdowns, or speed bonuses — explicitly out of scope for all scenarios (README).
- Kick/leave mid-game — explicitly out of scope for all scenarios (README).
- Real-time drawing sync via WebSockets — explicitly out of scope (README).
- Custom or random word packs — explicitly out of scope (README).
- Modifying Scenario 1 room/lobby behavior (create room, join room, lobby polling).
- Modifying Scenario 2 game-start, drawer assignment, or secret word selection behavior.
