# Feature Specification: Result, Restart & Final Validation

**Feature Branch**: `004-result-restart-validation`

**Created**: 2026-06-02

**Status**: Draft

**Scenario**: Scenario 4 — Result, Restart & Final Validation

---

## Context

This feature builds strictly on Scenarios 1–3. A round is already active with all Scenario 3
gameplay (canvas, guess submission, scoring) in place. Scenario 4 adds the final game-lifecycle
transitions: the host ends the round, all players see the result screen (correct word, final
scores, full guess history), the host can restart, and all players return to the lobby with
participants preserved and all round-specific state cleared.

No Scenario 1, 2, or 3 behavior is modified.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Host Ends the Round and Result State is Displayed (Priority: P1)

The host ends the active round by triggering the "End Round" action. The room transitions
from `"playing"` to `"result"` status. All players — on their next poll cycle — see the result
screen showing the correct secret word, the final scores for every participant, and the complete
guess history for the round.

**Why this priority**: Transitioning into the result state is the gateway for all other Scenario 4
behavior. Without a reliable end-round mechanism, the result screen and restart flow cannot be
reached.

**Independent Test**: Start a round with two players. As the host, trigger end-round. Confirm the
room status becomes `"result"`. On both player tabs, confirm the result screen appears within one
poll cycle (~2s). Confirm the secret word is visible on every participant's screen, the final
scores match what was accumulated during gameplay, and all guess entries are listed in submission
order.

**Acceptance Scenarios**:

1. **Given** the room is in `"playing"` status, **When** the host triggers "End Round", **Then**
   the server transitions the room to `"result"` status and sets the round's end timestamp.
2. **Given** the room has transitioned to `"result"`, **When** any participant polls
   `GET /rooms/:code/game`, **Then** the response includes `status: "result"`, the `secretWord`
   (visible to all players in result state), `scores`, and `guesses` for the completed round.
3. **Given** the room is in `"result"` status, **When** a non-host participant attempts to end
   the round, **Then** the server returns `403 Forbidden`.
4. **Given** the room is already in `"result"` status, **When** the host attempts to end the
   round again, **Then** the server returns `409 Conflict` — double-end is a no-op at the API
   level.
5. **Given** the room is not in `"playing"` status (e.g., `"lobby"`), **When** any participant
   calls the end-round endpoint, **Then** the server returns `409 Conflict: "Round is not active"`.
6. **Given** the room is in `"playing"` status, **When** a non-host participant views the game
   screen, **Then** the "End Round" button is not rendered — only the host sees and can
   interact with it.

---

### User Story 2 — Result Screen Renders Correct Word, Scores, and Guess History (Priority: P1)

Every participant's UI transitions from the game screen to the result screen after the round
ends. The result screen prominently shows the correct secret word, a scoreboard with every
participant's final score sorted descending, and the full chronological guess history with
correct/incorrect indicators and participant names.

**Why this priority**: The result screen is the primary end-of-round feedback mechanism for all
players. It depends on US1 being functional and directly drives user satisfaction.

**Independent Test**: After ending a round, open the result screen on the drawer's tab and a
guesser's tab. Confirm the secret word is displayed on both. Confirm the scoreboard lists all
participants sorted by score (highest first). Confirm the guess history lists every guess
submitted during the round, in order, with participant names and correct/incorrect marking.

**Acceptance Scenarios**:

1. **Given** the room is in `"result"` status, **When** any participant views the result screen,
   **Then** the secret word is prominently displayed regardless of whether they were the drawer
   or a guesser.
2. **Given** the result screen is displayed, **When** a participant views the scoreboard,
   **Then** every participant's final score is shown, sorted descending by score.
3. **Given** the result screen is displayed, **When** a participant views the guess history,
   **Then** every guess submitted during the round appears in chronological submission order,
   each showing the guesser's display name, the guess text, and a correct/incorrect indicator.
4. **Given** the result screen is displayed, **When** the drawer views the page, **Then** the
   drawer's own row appears in the scoreboard with a score of 0 — consistent with gameplay
   scoring rules.
5. **Given** a guesser correctly guessed the word during the round, **When** they view the
   result screen, **Then** their correct guess entry in the history has a visual indicator
   distinguishing it from incorrect entries.
6. **Given** the room is in `"result"` status and strokes exist in the API payload, **When**
   any participant views the result screen, **Then** no canvas drawing is rendered — the result
   screen displays only the secret word, scoreboard, and guess history.

---

### User Story 3 — Host Restarts and All Players Return to Lobby (Priority: P1)

The host triggers "Restart" from the result screen. The room transitions back to `"lobby"`
status. All participants who were in the room remain in the participant list. All round-specific
state (current round, strokes, guesses, scores, secret word, drawer) is cleared. All players
see the lobby on their next poll cycle.

**Why this priority**: Restart is the only supported game continuation path. Without it, the
game is a one-shot experience. It depends on US1 (result state) existing.

**Independent Test**: After viewing the result screen, click "Restart" as the host. Confirm the
room status returns to `"lobby"`. On both player tabs, confirm the lobby screen appears within
~2s. Confirm the participant list still includes every player who was present. Confirm there is
no residual round data (word, drawer, scores, guesses, canvas) on either tab.

**Acceptance Scenarios**:

1. **Given** the room is in `"result"` status, **When** the host triggers "Restart", **Then**
   the server transitions the room to `"lobby"` status and clears all round-specific state.
2. **Given** a restart has occurred, **When** any participant polls `GET /rooms/:code`,
   **Then** the participant list contains every player who was present before the restart — no
   participants are removed.
3. **Given** a restart has occurred, **When** the game state is inspected, **Then**
   `currentRound` is `null` (or the equivalent absent value), with no `secretWord`, `drawerId`,
   `strokes`, `guesses`, or `scores` from the previous round.
4. **Given** the room is in `"lobby"` status after restart, **When** a non-host participant
   attempts to restart, **Then** the server returns `403 Forbidden`.
5. **Given** the room is in `"playing"` status (not `"result"`), **When** any participant
   attempts to restart, **Then** the server returns `409 Conflict: "Round has not ended"`.
6. **Given** a restart has returned the room to `"lobby"`, **When** the host starts a new game,
   **Then** the new round initialises with fresh scores of 0, an empty strokes array, an empty
   guesses array, and a newly assigned drawer and secret word — exactly as Scenario 2 specifies.
7. **Given** a non-host participant is on the result screen and their `GET /rooms/:code/game`
   poll returns a no-active-round signal after the host has restarted, **When** the poll
   response is processed, **Then** the non-host player's frontend automatically navigates to
   the lobby view within ~2s — no manual action or page reload required.

---

### Edge Cases

- What happens when the host leaves before ending the round? → Out of scope for all scenarios
  (no kick/leave mechanic exists per README). The round remains active until the host ends it.
- What if a guess is submitted after the round has ended (race condition)? → The server checks
  room status is `"playing"` before processing a guess. If status is `"result"`, the server
  returns `409 Conflict: "Round has already ended"`.
- What if `POST /rooms/:code/canvas/stroke` or `DELETE /rooms/:code/canvas` is called while the
  room is in `"result"` status? → The server validates room status is `"playing"` before
  processing canvas mutations. In `"result"` status the server returns `409 Conflict:
  "Round is not active"` — consistent with how the same endpoints behave in `"lobby"` status.
- What if a non-existent room code is used for any Scenario 4 endpoint? → `404 Not Found`.
- What happens to in-memory state if the server restarts between end-round and restart? →
  All state is in-memory; a server restart clears everything. This is the accepted limitation
  per the project constitution.
- What if there are zero guesses when the round ends? → Valid; the result screen shows an
  empty guess history and all scores as 0. The round still transitions to `"result"` normally.
- What if only one participant is in the room (host is also the only player)? → The round can
  still be ended and restarted. No minimum participant count is enforced in Scenario 4.

---

## Requirements *(mandatory)*

### Functional Requirements

**End-Round Transition (FR-001 – FR-004)**

- **FR-001**: The system MUST expose a `POST /rooms/:code/end` endpoint. The request body MUST
  include `participantId` (string, required). On success, the room status transitions from
  `"playing"` to `"result"` and the endpoint returns `{ room: RoomSnapshot }`.
- **FR-002**: The server MUST validate that the `participantId` provided to `POST /rooms/:code/end`
  matches `room.hostId`. If not, return `403 Forbidden` with `"Only the host can end the round"`.
- **FR-003**: If the room is not in `"playing"` status when `POST /rooms/:code/end` is called,
  the server MUST return `409 Conflict` with `"Round is not active"`.
- **FR-004**: The end-round transition MUST be idempotent from a state perspective — calling it
  when already in `"result"` returns `409 Conflict` rather than causing a second transition.

**Result State Visibility (FR-005 – FR-009)**

- **FR-005**: When the room is in `"result"` status, the `GET /rooms/:code/game` response MUST
  include `secretWord` in the snapshot for ALL participants (drawer and guessers alike). In
  `"playing"` status the `secretWord` is only sent to the drawer (unchanged from Scenario 2).
- **FR-006**: The `GET /rooms/:code/game` response in `"result"` status MUST include: `status`,
  `secretWord`, `scores` (final), `guesses` (full history), `strokes` (final canvas state),
  `participants`, and `drawerId`.
- **FR-007**: The frontend MUST detect `status === "result"` from the poll response and render
  the result screen instead of the game screen.
- **FR-008**: The result screen MUST display the secret word prominently.
- **FR-009**: The result screen MUST render the scoreboard (all participants, sorted descending
  by score) and the full guess history (chronological, with participant name, guess text, and
  correct/incorrect indicator) — reusing or extending the components from Scenario 3. No
  "winner" label, badge, or highlight is applied to the top scorer; scores are displayed
  neutrally.
- **FR-009a**: The result screen MUST NOT render the canvas drawing. The `strokes` field
  returned in the `GET /rooms/:code/game` response during `"result"` status is present as part
  of the shared `GameSnapshot` shape and MUST be ignored by the result screen UI. The three
  and only three visual elements on the result screen are: the secret word, the scoreboard,
  and the guess history.

**Restart Transition (FR-010 – FR-015)**

- **FR-010**: The system MUST expose a `POST /rooms/:code/restart` endpoint. The request body
  MUST include `participantId` (string, required). On success, the room transitions to `"lobby"`
  status and returns `{ room: RoomSnapshot }`.
- **FR-011**: The server MUST validate that the `participantId` provided to
  `POST /rooms/:code/restart` matches `room.hostId`. If not, return `403 Forbidden` with
  `"Only the host can restart"`.
- **FR-012**: If the room is not in `"result"` status when `POST /rooms/:code/restart` is called,
  the server MUST return `409 Conflict` with `"Round has not ended"`.
- **FR-013**: On restart, the server MUST clear ALL round-specific state: `currentRound` is set
  to `null` (no `secretWord`, `drawerId`, `strokes`, `guesses`, `scores`).
- **FR-014**: On restart, ALL participants who were present in the room MUST remain in
  `room.participants`. No participant is removed during the restart transition.
- **FR-015**: After restart, polling `GET /rooms/:code` MUST return `status: "lobby"` with the
  full participant list intact. The room is now in a state identical to Scenario 1 post-join —
  ready for the host to start a new game per Scenario 2 rules.

**Frontend Lifecycle (FR-016 – FR-020)**

- **FR-016**: The frontend `GET /rooms/:code/game` polling (existing ~2s interval from Scenario 2)
  MUST detect the `"result"` status and transition all players' UI to the result screen without
  requiring a page reload. The same poll MUST also detect a post-restart signal (see FR-018a)
  and navigate all players back to the lobby.
- **FR-017**: The result screen MUST include a "Restart" button visible and enabled only for the
  host participant. Non-host participants see the button disabled or hidden.
- **FR-018**: When the host clicks "Restart", the frontend MUST call `POST /rooms/:code/restart`.
  On success the host's frontend updates local room state to `"lobby"` and navigates to the
  lobby view immediately.
- **FR-018a**: After a successful restart, `GET /rooms/:code/game` MUST return a response
  indicating no active round (either `status: "lobby"` in the payload, or a `409 Conflict` with
  a `"Round is not active"` body). The frontend MUST interpret this signal during result-state
  polling and automatically navigate the player to the lobby — covering non-host players who
  never called the restart endpoint.
- **FR-019**: After all players have navigated to the lobby, the lobby polling from Scenario 1
  (`GET /rooms/:code`, ~2s interval) MUST resume automatically and reflect the full participant
  list — no re-join or page reload required for any participant.
- **FR-020**: On the game screen during `"playing"` status, the "End Round" button MUST be
  visible and enabled only for the host participant. Non-host players MUST NOT see the button
  at all — consistent with the "Restart" button pattern on the result screen (FR-017) and the
  "Start Game" button pattern from Scenario 1.

### Key Entities

- **Round** (from Scenario 2/3): No new fields added in Scenario 4. The `currentRound` on the
  `Room` object is set to `null` on restart to signal the cleared state.
- **Room** (from Scenario 1): The `status` field gains the new value `"result"` in addition to
  the existing `"lobby"` and `"playing"` values. Participant list is preserved across restart.
- **ResultSnapshot**: The `GameSnapshot` shape (from Scenario 3) is reused in `"result"` status,
  with the only difference being that `secretWord` is included for all participants (not just
  the drawer).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All players see the result screen within one poll cycle (~2s) of the host ending
  the round — no manual page refresh required.
- **SC-002**: The secret word is visible to 100% of participants (drawer and all guessers) on
  the result screen.
- **SC-003**: Final scores displayed on the result screen match exactly the scores accumulated
  during Scenario 3 gameplay — no score recalculation occurs at end-round.
- **SC-004**: All guess entries submitted during the round appear in the result screen history
  in chronological order, with correct/incorrect indicators, for 100% of participants.
- **SC-005**: After a host-triggered restart, all players see the lobby screen within one poll
  cycle (~2s) with the full participant list intact — no re-join or page reload needed.
- **SC-006**: After restart, zero round-specific fields (word, drawer, strokes, guesses, scores)
  are accessible via any API endpoint — the slate is completely clean.
- **SC-007**: A new game started after restart follows identical Scenario 2 rules — fresh scores,
  empty canvas, empty history, newly assigned drawer and word.

---

## Clarifications

### Session 2026-06-02

- Q: Does the round end only when the host explicitly triggers it, or can it also end automatically once every eligible guesser has submitted a correct guess? → A: Host-only manual trigger. The round stays active indefinitely until the host clicks "End Round", regardless of guess outcomes. Auto-end on all-correct is out of scope.
- Q: Should the result screen designate a single "winner" with any distinct visual treatment, or simply list all final scores with no winner concept? → A: No winner designation. The result screen shows all participants' scores sorted descending. No label, badge, or highlight distinguishes the top scorer.
- Q: How do non-host participants detect that a restart has occurred and navigate back to the lobby view? → A: The existing `GET /rooms/:code/game` poll returns `status: "lobby"` (or equivalent no-active-round signal) after restart. The frontend interprets this and automatically navigates all polling participants to the lobby within ~2s — no manual action required from non-host players.
- Q: On the game screen during playing state, is the "End Round" button visible only to the host, or visible to all players with server-side enforcement only? → A: The "End Round" button is visible and enabled only for the host. Non-host players do not see it at all — consistent with the "Restart" button pattern on the result screen.
- Q: Should the final canvas drawing be displayed on the result screen, or is it included in the API payload only and not rendered in the result UI? → A: The canvas is NOT rendered on the result screen. The `strokes` field is present in the API response as part of the shared GameSnapshot shape but the result screen UI ignores it. The result screen shows only: secret word, scoreboard, and guess history.

---

## Assumptions

- Scenarios 1, 2, and 3 are fully implemented. The room can reach `"playing"` status, and the
  Scenario 3 gameplay endpoints (`/canvas/stroke`, `/canvas`, `/guess`) all work correctly.
- The `hostId` is already tracked on the `Room` object (established in Scenario 1/2) and used
  for host-only action authorization.
- `GET /rooms/:code/game` is the existing polling endpoint; the `"result"` status is an additive
  value to the `status` field, not a new endpoint.
- The ~2s frontend polling interval from Scenario 2/3 is reused unchanged for result-state
  detection.
- The round ends only when the host explicitly triggers "End Round". No automatic end-of-round occurs (not on timer, not on all-correct guesses, not on any game event). This is consistent with the README "Explicitly Out of Scope" list which excludes timers, countdowns, and automatic events.
- No minimum participant count is required to end a round or restart.
- After restart, the host must manually click "Start Game" again (Scenario 2 flow) to begin a
  new round. Restart does not auto-start a new game.
- The "Restart" button state (enabled for host, disabled/hidden for others) is determined
  client-side from the locally stored `participantId` compared to `room.hostId` in the poll
  response.
- All state is in-memory. Server restarts clear all data — accepted limitation per constitution.

---

## Non-Goals (Strict Scenario 4 Boundary)

- Multiple rounds or automated drawer rotation — explicitly out of scope (README).
- Timers, countdowns, or automatic end-of-round — explicitly out of scope (README).
- Kick/leave mid-game or result-screen departure — explicitly out of scope (README).
- Score persistence across server restarts — no database per constitution.
- Modifying Scenario 1 room-creation or join behavior.
- Modifying Scenario 2 game-start, drawer assignment, or secret word selection behavior.
- Modifying Scenario 3 canvas, guess submission, or scoring behavior.
- WebSockets or any real-time push protocol — HTTP polling only per constitution.
- Authentication or sessions — no auth per constitution.
