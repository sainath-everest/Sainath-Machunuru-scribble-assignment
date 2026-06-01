# Feature Specification: Game Start Transition

**Feature Branch**: `002-game-start-transition`

**Created**: 2026-06-01

**Status**: Draft

**Scenario**: Scenario 2 — Game Start Transition & Round Initialization

---

## Context

This feature builds **strictly** on the Scenario 1 lobby. It describes exactly what happens the
moment the host clicks "Start Game": the room status transitions from `"lobby"` to `"playing"`,
the first round is initialized, a drawer is assigned, and a secret word is selected and made
visible **only** to the drawer. No Scenario 1 behavior is modified. No Scenario 3 logic
(scoring, guessing results, round cycling) is introduced.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Host Starts the Game and Transitions to Playing (Priority: P1)

The host, with at least 2 players present, clicks "Start Game". The room immediately moves
from lobby to a playing state. The host is redirected to the game screen where round 1 is
active and a drawer has been assigned.

**Why this priority**: This is the gateway to every downstream game interaction. No round can
exist without a transition out of the lobby.

**Independent Test**: Open two tabs — Tab A (host) and Tab B (second player) both in the lobby.
Tab A clicks "Start Game". Confirm Tab A is redirected to `/game`. Confirm the server now
reports `status: "playing"` for that room code. Confirm a `drawerId` is set and a secret word
exists server-side for the round.

**Acceptance Scenarios**:

1. **Given** a lobby with 2 or more participants and the host authenticated, **When** the host
   clicks "Start Game", **Then** the room status changes to `"playing"`, a new round object is
   created with `roundNumber: 1`, a drawer is assigned, a secret word is selected from the
   starter word list, and the host's browser navigates to the game screen.
2. **Given** the room has transitioned to `"playing"`, **When** any client polls `GET /rooms/:code`,
   **Then** the response includes `status: "playing"` — `drawerId` and `secretWord` are both
   absent from the room snapshot. Clients must call `GET /rooms/:code/game` to obtain game-phase data.
3. **Given** the game has already started (status is `"playing"`), **When** the host attempts
   to start again via a second `POST /rooms/:code/start` request, **Then** the server returns
   a `409 Conflict` error and the room state is unchanged.

---

### User Story 2 — Drawer Receives Their Secret Word (Priority: P1)

After the game starts, the assigned drawer fetches their private game view. Their response
includes the secret word that they must draw. No other participant can obtain the word through
any shared endpoint.

**Why this priority**: The drawer–guesser information asymmetry is the core mechanic of the
game. Without it no round has meaning.

**Independent Test**: After starting the game, call the game-state endpoint from the drawer's
`participantId`. Confirm the `secretWord` field is present in the response. Call the same
endpoint from a guesser's `participantId`. Confirm `secretWord` is absent from their response.

**Acceptance Scenarios**:

1. **Given** the game is in `"playing"` status and the caller's `participantId` matches the
   `drawerId`, **When** they request the game state, **Then** the response includes
   `secretWord` (the actual word the drawer must draw).
2. **Given** the game is in `"playing"` status and the caller's `participantId` does NOT match
   the `drawerId`, **When** they request the game state, **Then** the response **omits**
   `secretWord` entirely (the field is not present, not null, not empty).
3. **Given** a request arrives without a `participantId`, **When** the game state is fetched,
   **Then** the response is treated as a guesser view — `secretWord` is omitted.

---

### User Story 3 — Drawer Role Assignment (Priority: P1)

The system deterministically assigns exactly one participant as the drawer when a game starts.
The host is preferred as drawer. If the host has already left the room (edge case), the first
remaining participant in join order becomes the drawer.

**Why this priority**: Every round requires a unique drawer identity. The assignment rule must
be unambiguous and reproducible.

**Independent Test**: Create a room, join a second player, start the game. Confirm `drawerId`
in the server state equals the host's `participantId`. Then (separate test) remove the host
from the participant list before starting, start the game, and confirm `drawerId` equals the
first remaining participant's `participantId`.

**Acceptance Scenarios**:

1. **Given** the host is still in the participant list at game start, **When** the game starts,
   **Then** `drawerId` equals `room.hostId`.
2. **Given** the host is absent from the participant list at game start (edge case),
   **When** the game starts, **Then** `drawerId` equals the `id` of the first participant in
   join-order (index 0).
3. **Given** a game in progress, **When** any client reads the room or game-state snapshot,
   **Then** exactly one `drawerId` is present and it matches a valid `participantId` in the
   participant list.

---

### User Story 4 — Non-Host Players See the Game Screen After Start (Priority: P2)

Non-host players, who remain in the lobby after the host starts the game, will transition to
the game screen on their next poll cycle. They arrive at the game screen in guesser view — no
secret word visible, only the drawing canvas and guess input area are shown.

**Why this priority**: Without this, non-host players are stranded in the lobby forever once
the host starts the game. The guesser experience must begin automatically.

**Independent Test**: Tab B (non-host) keeps polling the lobby. After Tab A starts the game,
wait one poll cycle (~2s). Confirm Tab B navigates to `/game`. Confirm no `secretWord` is
visible in Tab B's game view.

**Acceptance Scenarios**:

1. **Given** a non-host player is polling the lobby at ~2s intervals, **When** the room status
   becomes `"playing"`, **Then** the player's next successful poll detects the status change and
   the frontend automatically navigates them to `/game`.
2. **Given** a non-host player has navigated to `/game`, **When** they load the game screen,
   **Then** they see the guesser view — `secretWord` is not displayed.

---

### Edge Cases

- What happens when a 1-player room somehow reaches the start endpoint? → Server rejects with
  `400 Bad Request`: "Need at least 2 players to start".
- What happens if the word list is empty? → Server rejects the start with `500` / `503`:
  "No words available"; room status is not changed.
- What happens if the start endpoint is called on a room already in `"playing"` status? →
  `409 Conflict`; game state is unchanged.
- What happens if the `participantId` in a game-state request doesn't match any participant? →
  Treated as guesser view; `secretWord` is omitted.
- What if two clients simultaneously hit the start endpoint? → Only the first request succeeds
  (status transition is atomic); the second receives `409 Conflict`.
- What if a non-host participant (or an outside caller) sends `POST /rooms/:code/start` with
  their own `participantId`? → Server returns `403 Forbidden`; game state is unchanged.
- What if `POST /rooms/:code/start` is called with no `participantId` in the body? → Server
  returns `403 Forbidden` (treated identically to a non-host caller).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a `POST /rooms/:code/start` endpoint that accepts a
  `participantId` field in the request body and transitions a lobby room into the `"playing"` state.
- **FR-001a**: The start endpoint MUST verify that the supplied `participantId` equals `room.hostId`.
  If it does not match, the server MUST return `403 Forbidden` with message "Only the host can start the game".
  If `participantId` is absent from the request body, the server MUST also return `403 Forbidden`.
- **FR-002**: The start endpoint MUST reject requests when fewer than 2 participants are present
  with a `400 Bad Request` and message "Need at least 2 players to start".
- **FR-003**: The start endpoint MUST reject requests when the room is already in `"playing"`
  status with a `409 Conflict` response.
- **FR-004**: On a successful start, the system MUST create a round object containing at minimum:
  `roundNumber` (1), `drawerId`, and `secretWord`.
- **FR-005**: The `drawerId` MUST be set to the room's `hostId` if the host is still a
  participant; otherwise it MUST be set to the `id` of the first participant in join-order.
- **FR-006**: The `secretWord` MUST be selected randomly from the starter word list.
- **FR-007**: The `secretWord` MUST be stored server-side only and MUST NOT be included in any
  shared room snapshot accessible to all clients.
- **FR-008**: A new `GET /rooms/:code/game` endpoint MUST be introduced for the playing-state
  view. It MUST accept an optional `participantId` query parameter to determine caller identity.
- **FR-009**: When the `participantId` supplied to `GET /rooms/:code/game` matches `drawerId`,
  the response MUST include `secretWord`.
- **FR-010**: When the `participantId` does NOT match `drawerId` (or is absent), `GET /rooms/:code/game`
  MUST omit `secretWord` entirely (field absent, not null).
- **FR-011**: `GET /rooms/:code` (the existing Scenario 1 endpoint) MUST be extended minimally:
  when status is `"playing"`, its `RoomSnapshot` response includes the updated `status` field
  only. It MUST NOT include `drawerId` or `secretWord`; those fields belong exclusively to
  the `GET /rooms/:code/game` response.
- **FR-012**: The frontend lobby polling logic (`GET /rooms/:code`) MUST detect a
  `status: "playing"` response and automatically navigate non-host players to `/game`.
- **FR-013**: The host's "Start Game" click MUST navigate them immediately to `/game` on API
  success — no polling required for the host's own transition.
- **FR-014**: The system MUST NOT modify the request/response contract of `POST /rooms`,
  `POST /rooms/:code/join`, or the existing fields returned by `GET /rooms/:code` during
  `status: "lobby"`. The only additive change to `GET /rooms/:code` is the `status` field
  value changing to `"playing"` — no new fields are added to the RoomSnapshot type.
- **FR-015**: Once on the game screen, all clients (drawer and guessers) MUST poll
  `GET /rooms/:code/game?participantId=...` at ~2s to keep game state current. The lobby
  polling of `GET /rooms/:code` MUST stop when the client leaves the lobby screen.

### Key Entities

- **Room**: Extended with `status: "lobby" | "playing"` (was `"lobby"` only) and
  `currentRound: Round | null`. The `RoomSnapshot` (what `GET /rooms/:code` returns) exposes
  only `status` — it never exposes `drawerId` or `secretWord`.
- **Round**: New entity — `roundNumber: number`, `drawerId: string`, `secretWord: string`.
  Stored server-side only; never serialized directly into a shared snapshot.
- **GameSnapshot** (drawer view): Returned by `GET /rooms/:code/game?participantId={drawerId}` —
  includes `status`, `roundNumber`, `drawerId`, `secretWord`, `participants`.
- **GameSnapshot** (guesser view): Returned by `GET /rooms/:code/game?participantId={other}` or
  without `participantId` — identical to drawer view but with `secretWord` absent.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host with 2+ players can start a game in a single click — the transition from
  lobby to playing completes without any additional user steps.
- **SC-002**: 100% of game-state responses to guesser-role participants contain no `secretWord`
  field under any test condition.
- **SC-003**: 100% of game-state responses to the drawer contain the correct `secretWord` field.
- **SC-004**: The secret word is selected from the starter word list — no words outside that
  list ever appear in a drawer response.
- **SC-005**: Non-host players transition to the game screen within one poll cycle (~2s) of the
  host starting the game — no manual refresh required.
- **SC-006**: The start endpoint correctly rejects all invalid start attempts (fewer than 2
  players, already playing) with the appropriate error status and message.
- **SC-007**: 100% of start attempts from a non-host `participantId` (or without one) are
  rejected with `403 Forbidden` — the game state remains unchanged in every such case.

---

## Assumptions

- Scenario 1 (`"lobby"` state, participant list, host tracking, polling) is already fully
  implemented and working as specified in `specs/001-room-setup-lobby/spec.md`.
- The starter word list (`STARTER_WORDS` in `backend/src/seed/starterData.ts`) is non-empty
  and contains at least one word at all times during normal operation.
- Each room supports exactly one active round at a time in Scenario 2 — multiple concurrent
  rounds per room are not in scope.
- Round cycling (starting a second round after the first ends) is Scenario 3 scope and is
  excluded here.
- Scoring, guess submission, and results are Scenario 3 scope and excluded here.
- The game canvas and guess UI elements are rendered on the `/game` route but their interactive
  functionality (drawing, submitting guesses, receiving scores) is Scenario 3 scope.
- `hostId` (established in Scenario 1) is the authoritative source for drawer assignment
  preference; no additional role-selection UI is needed.
- No authentication or sessions are used. However, `POST /rooms/:code/start` performs a
  game-rule integrity check: the supplied `participantId` must equal `room.hostId`. All other
  endpoints (`GET /rooms/:code/game`) treat `participantId` as self-reported and use it only
  to determine information visibility (drawer vs guesser view) — not to gatekeep access.
- HTTP polling by non-host players at ~2s intervals is the mechanism for detecting the
  `"playing"` status transition; no push notifications are used.

---

## Clarifications

### Session 2026-06-01

- Q: Is there a dedicated game-state endpoint separate from `GET /rooms/:code`, or does the same endpoint serve both lobby and game-state views? → A: New dedicated endpoint `GET /rooms/:code/game` is introduced. It returns a `GameSnapshot` and conditionally includes `secretWord` based on the `participantId` query param. `GET /rooms/:code` is kept strictly as the room/lobby metadata endpoint (RoomSnapshot); it is not overloaded with game-state semantics.
- Q: Once non-host players reach the game screen, do they poll `GET /rooms/:code` or switch to `GET /rooms/:code/game`? → A: Game screen polls `GET /rooms/:code/game?participantId=...` at ~2s. `GET /rooms/:code` only needs to return `status: "playing"` for the lobby-to-game redirect detection — `drawerId` is NOT added to the RoomSnapshot. All game-phase data (drawer identity, secret word visibility) is served exclusively by the game endpoint.
- Q: Should `POST /rooms/:code/start` validate the caller is the host, or is frontend-only gating sufficient? → A: Require `participantId` in the request body; server validates it equals `room.hostId` and returns `403 Forbidden` if not. This is a game-rule integrity check, not authentication.

---

## Non-Goals (Strict Scenario 2 Boundary)

- Guess submission or validation — Scenario 3.
- Scoring or scoreboard — Scenario 3.
- Round cycling (moving to round 2, 3, …) — Scenario 3.
- Results / winner display — Scenario 3.
- Refactoring or modifying any Scenario 1 endpoint behavior.
- Persisting game state across server restarts (in-memory only, per constitution).
- Timer/countdown for round duration — Scenario 3.
- Kick/leave mid-game functionality — out of scope for all current scenarios.
