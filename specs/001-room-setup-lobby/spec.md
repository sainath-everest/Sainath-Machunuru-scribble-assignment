# Feature Specification: Room Setup & Lobby

**Feature Branch**: `001-room-setup-lobby`

**Created**: 2026-06-01

**Status**: Draft

**Scenario**: Scenario 1 — Room Setup & Lobby

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Host Creates a Room and Enters the Lobby (Priority: P1)

A player wants to start a new game. They provide their name, create a room, and land in the
lobby where they are identified as the host. The room code is displayed so they can share it
with others.

**Why this priority**: This is the entry point for every game session. Nothing else can
happen until at least one room exists with an identified host.

**Independent Test**: Open one browser tab, enter a player name, click "Create Room", and
confirm the lobby shows the room code, the player appears in the participant list, and a
"Host" indicator is visible next to their name.

**Acceptance Scenarios**:

1. **Given** a player is on the Start screen, **When** they enter a non-empty player name
   and submit the Create Room form, **Then** a room with a unique 4-character code is
   created, the player is recorded as the host, and they are redirected to the Lobby screen.
2. **Given** a player is in the lobby they just created, **When** the lobby renders,
   **Then** the room code is prominently displayed and their name appears in the participant
   list with a visible "Host" label.
3. **Given** a player submits the Create Room form with an empty or whitespace-only player
   name, **When** the form is submitted, **Then** an inline error message is shown and no
   room is created.

---

### User Story 2 — Second Player Joins a Room by Code (Priority: P1)

A second player wants to join an existing room. They provide their name and enter the room
code they received from the host. On success they land in the same lobby.

**Why this priority**: A game requires at least two players. Joining is a prerequisite for
every downstream scenario.

**Independent Test**: With one tab hosting a room, open a second tab, enter a player name
and the room code, click "Join Lobby", and confirm the second player appears in the
participant list in both tabs after the lobby refreshes.

**Acceptance Scenarios**:

1. **Given** a player enters a valid room code and a non-empty player name, **When** they
   submit the Join Room form, **Then** they are added to the room's participant list and
   redirected to the Lobby screen.
2. **Given** a player enters a room code that does not match any active room, **When** they
   submit the form, **Then** a clear error message is displayed ("Room not found" or
   equivalent) and they remain on the Join screen.
3. **Given** a player submits the Join Room form with an empty or whitespace-only player
   name, **When** the form is submitted, **Then** an inline error message is shown and the
   join request is not sent.
4. **Given** a player submits the Join Room form with an empty room code, **When** the form
   is submitted, **Then** an inline error message is shown and the join request is not sent.

---

### User Story 3 — Lobby Auto-Refreshes to Show New Participants (Priority: P2)

While waiting in the lobby, all participants (host and guests) see new joiners appear
automatically without pressing a button. The lobby polls the server approximately every 2
seconds.

**Why this priority**: Without auto-refresh, the host cannot know when enough players have
joined to start the game. Manual refresh is a workaround, not the required experience.

**Independent Test**: With one tab in the lobby, open a second tab and join the room. Within
3 seconds, confirm the second player's name appears in the first tab's participant list
without any manual interaction.

**Acceptance Scenarios**:

1. **Given** a player is on the Lobby screen, **When** the page is open, **Then** the
   client polls the server for updated room state approximately every 2 seconds
   (interval between 1.5 s and 3 s is acceptable).
2. **Given** a second player joins a room, **When** the next polling cycle completes in the
   host's tab, **Then** the new participant's name appears in the host's lobby participant
   list without a page reload or manual action.
3. **Given** a player navigates away from the Lobby screen, **When** they leave, **Then**
   polling stops and no further requests are sent for that room.

---

### User Story 4 — Host Starts the Game with Minimum 2 Players (Priority: P2)

The host is the only person who can start the game, and only once at least 2 players are
present in the lobby. Non-host participants see the Start Game button as either hidden or
disabled.

**Why this priority**: This enforces fair game preconditions and restricts a privileged
action to the correct user.

**Independent Test**: With only the host in the lobby, confirm the Start Game button is
disabled or absent. Then have a second player join; confirm the host's Start Game button
becomes enabled. Confirm clicking it navigates to the game screen, while the non-host
player's button remains disabled.

**Acceptance Scenarios**:

1. **Given** the host is in the lobby with fewer than 2 participants, **When** the lobby
   renders, **Then** the Start Game button is disabled (or visually indicated as unavailable)
   with a message indicating more players are needed.
2. **Given** the host is in the lobby with 2 or more participants, **When** the lobby
   renders, **Then** the Start Game button is enabled and actionable.
3. **Given** a non-host participant is in the lobby, **When** the lobby renders regardless
   of participant count, **Then** the Start Game button is either hidden or permanently
   disabled for that participant.
4. **Given** the host clicks Start Game with 2 or more participants present, **When** the
   action completes, **Then** the host is navigated to the Game screen. Non-host participants
   remain on the Lobby screen with the Start Game button hidden or disabled.

---

### User Story 5 — Rooms Are Fully Isolated (Priority: P1)

Two separate rooms must not share participants or state. A player in one room cannot see or
affect the other room.

**Why this priority**: Cross-room data leakage is a correctness defect that invalidates
every other scenario.

**Independent Test**: Create two rooms in separate tabs with different room codes. Join each
room with a different player. Confirm that the participant list in Room A does not show the
player from Room B, and vice versa.

**Acceptance Scenarios**:

1. **Given** two rooms exist with different codes, **When** a player joins Room A,
   **Then** that player does not appear in the participant list of Room B.
2. **Given** two rooms exist, **When** either room is fetched by its code, **Then** only
   participants who joined that specific room are returned.

---

### Edge Cases

- What happens when a room code is entered in lowercase? The server MUST accept it
  case-insensitively (normalise to uppercase on both client and server).
- What happens if the backend is unrestarted and a room code collides? Room code generation
  MUST retry until a unique code is produced.
- What if a player's name consists entirely of whitespace (e.g., `"   "`)? The backend
  MUST reject it as invalid after trimming; the frontend MUST surface the error.
- What if the polling request fails (network error, backend down)? The lobby MUST display
  a non-crashing error indicator and continue polling at the same ~2s interval unchanged;
  it MUST NOT redirect the user away or alter the polling cadence.
- What if a player opens the lobby URL directly without having created or joined a room?
  They MUST be redirected to the Start screen.

---

## Clarifications

### Session 2026-06-01

- Q: When the host clicks Start Game, what happens to non-host participants still in the lobby? → A: Only the host navigates to /game on click. Non-host participants remain in the lobby with the Start Game button hidden or disabled. Non-host game navigation is not in Scenario 1 scope.
- Q: Is `hostId` included in the room snapshot returned to the client? → A: Yes — `hostId` (the creator's participantId) is included in every RoomSnapshot response so the client can determine host identity without inferring from list order.
- Q: After a polling request fails, what happens to the ~2s polling interval? → A: Continue at the same ~2s interval unchanged; errors are shown in the lobby but the polling cadence never changes.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record the first participant in a newly created room as the
  host.
- **FR-002**: Room creation MUST reject player names that are empty or consist only of
  whitespace, returning a user-visible error.
- **FR-003**: Room joining MUST reject player names that are empty or consist only of
  whitespace, returning a user-visible error.
- **FR-004**: Room joining MUST reject room codes that are empty, returning a user-visible
  error.
- **FR-005**: Room joining MUST return a clear error when the provided room code does not
  match any active room.
- **FR-006**: Room codes MUST be matched case-insensitively; the system normalises codes to
  uppercase before lookup.
- **FR-007**: The Lobby screen MUST poll the server for updated room state on an interval of
  approximately 2 seconds.
- **FR-008**: Polling MUST stop when the player navigates away from the Lobby screen.
- **FR-009**: The Lobby screen MUST display a "Host" indicator for the participant who
  created the room.
- **FR-010**: The Start Game button MUST be disabled or hidden for non-host participants at
  all times.
- **FR-011**: The Start Game button MUST be disabled for the host when fewer than 2
  participants are present in the room.
- **FR-012**: The Start Game button MUST become enabled for the host when 2 or more
  participants are present.
- **FR-013**: Each room MUST maintain an independent participant list; joining one room MUST
  NOT affect any other room.
- **FR-014**: The Lobby screen MUST redirect unauthenticated visitors (those without an
  active room session) to the Start screen.
- **FR-015**: A polling failure MUST display a non-fatal error indicator in the lobby
  without redirecting the user or stopping future poll attempts. The polling interval
  MUST remain unchanged (~2s) regardless of how many consecutive failures have occurred.
- **FR-016**: Every RoomSnapshot response MUST include the `hostId` field containing the
  participantId of the room creator, so clients can determine host identity without
  relying on participant list ordering.

### Key Entities

- **Room**: Represents an active game lobby. Has a unique code, a list of participants, a
  `hostId` (the participantId of the creator), and a status. `hostId` is set at creation
  time and never transferred.
- **RoomSnapshot**: The read-only room payload returned to clients on every fetch or join.
  MUST include `hostId` so the client can identify the host without relying on participant
  list order.
- **Participant**: A player within a room. Has a unique ID, a display name, and a joined
  timestamp.
- **RoomSession**: The client-side identity for a player in a specific room. Consists of
  the participant ID and the current room snapshot.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can create a room, share the code, and have a second player join
  within 60 seconds using two browser tabs with no technical guidance.
- **SC-002**: A newly joined participant appears in all existing lobby participants' views
  within 3 seconds of joining, without any manual interaction.
- **SC-003**: Attempting to start a game with only 1 participant is impossible through
  normal UI interaction regardless of the participant's role.
- **SC-004**: Joining a room with an invalid code or empty name produces a visible,
  human-readable error message on the same screen without losing the entered data.
- **SC-005**: Two simultaneously active rooms each display only their own participants with
  100% accuracy.

---

## Assumptions

- A player's `participantId` and `roomCode` are held in client-side memory (React Context)
  for the duration of the browser session. Tab refresh loses the session; persistence to
  `sessionStorage` is out of scope for this scenario.
- The host is defined as the participant whose ID matches `room.hostId`, which is set at
  room creation time and never transferred.
- The polling interval is implemented with `setInterval`/`clearInterval` inside a
  `useEffect` hook. Polling uses the existing `fetchRoom` method; no new API endpoint is
  needed.
- Room codes are 4-character strings drawn from an unambiguous alphabet (no O/0, I/1
  confusion). The existing `generateCode` implementation satisfies this.
- "Start Game" navigating the **host** to the Game screen is the complete behavior for
  Scenario 1. No server-side game-state transition occurs. Non-host participants remain
  in the lobby with the Start Game button hidden or disabled. Non-host navigation is not
  in Scenario 1 scope.
- There is no persistent host re-election if the host leaves. Out of scope.

---

## Non-Goals *(explicit exclusions)*

The following are explicitly out of scope for this feature and MUST NOT be implemented
as part of Scenario 1:

- Drawer assignment, word selection, or any round-level game state (Scenario 2).
- Guess submission, canvas drawing, or score tracking (Scenario 3).
- Result display or restart flow (Scenario 4).
- WebSockets or any push-based real-time synchronization.
- Persistent storage; all state remains in server memory.
- Authentication, sessions, accounts, or JWT.
- Host re-election if the original host disconnects.
- Room capacity limits or room expiry.
- Spectator mode or moderation features.
- Multi-round support, drawer rotation, or timers.
