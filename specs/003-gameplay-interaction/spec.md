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
renders visible strokes. Click "Clear Canvas". Confirm all strokes disappear immediately.
[NEEDS CLARIFICATION: Confirm that after clearing, a guesser polling the game state also
sees the cleared canvas — OR confirm the canvas state is local to the drawer only and guessers
see a static placeholder.]

**Acceptance Scenarios**:

1. **Given** the active round's drawer is viewing the game screen, **When** they press the
   pointer and drag on the canvas, **Then** a continuous freehand stroke is rendered at the
   correct position on the canvas.
2. **Given** strokes exist on the canvas, **When** the drawer clicks "Clear Canvas", **Then**
   all existing strokes are removed from the canvas immediately on the drawer's screen.
3. **Given** [NEEDS CLARIFICATION: drawing state is stored server-side], **When** a guesser
   polls the game state, **Then** their canvas reflects the drawer's current drawing. **OR**
   **Given** drawing state is drawer-local only, **When** a guesser is on the game screen,
   **Then** they see a static placeholder ("Drawing in progress…") and cannot interact with
   the canvas.
4. **Given** a guesser is on the game screen, **When** they attempt to draw, **Then** the
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
3. **Given** [NEEDS CLARIFICATION: a participant submits a correct guess a second time],
   **When** the server processes it, **Then** their score increments by another 100 (no limit
   on re-guessing) — OR their score does not change (one scoring event per guesser per round).
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
  [NEEDS CLARIFICATION: Reject with `403 Forbidden`; OR accept the guess as an anonymous
  guesser (scored as a new participant). The more secure option is 403.] Assumption: reject
  with `404 Not Found` if `participantId` is absent or unknown.
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
- **FR-003**: [NEEDS CLARIFICATION: The drawing state (stroke coordinates and clear events)
  MUST be stored server-side in the `Round` object and included in the `GET /rooms/:code/game`
  response so that guessers can see the current drawing via polling; OR the canvas is local to
  the drawer only and guessers see a static placeholder — no drawing data is stored or
  transmitted server-side.]
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
- **FR-009**: The server MUST compare the trimmed, lowercased guess to the trimmed, lowercased
  `currentRound.secretWord`. A match increments the participant's score by 100. No match adds 0.
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
- **FR-017**: [NEEDS CLARIFICATION: A participant MAY submit multiple correct guesses and
  each correct guess adds 100 to their score (no cap); OR each participant's score for a
  correct guess is capped — a second correct submission from the same participant is recorded
  in history but adds 0 points.]

### Key Entities

- **Guess**: A single guess record within a round.
  Attributes: `participantId` (string), `text` (string, trimmed), `correct` (boolean),
  `submittedAt` (ISO-8601 string).
- **Round** (extended from Scenario 2): Gains `guesses: Guess[]` (append-only, starts empty)
  and `scores: Record<string, number>` (keyed by `participantId`, all start at `0`).
- **GameSnapshot** (extended from Scenario 2): Gains `guesses: Guess[]` and
  `scores: Record<string, number>` in both drawer and guesser views. If canvas sync is in
  scope (see FR-003 clarification), the snapshot also gains a drawing state field.

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
- The `POST /rooms/:code/guess` endpoint treats `participantId` as self-reported (consistent
  with `GET /rooms/:code/game`). The only server-side enforcement is that the drawer cannot
  guess — no participant list membership check is assumed unless clarified.
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
