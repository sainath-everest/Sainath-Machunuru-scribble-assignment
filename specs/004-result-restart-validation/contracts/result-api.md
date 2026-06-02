# API Contracts: Result, Restart & Final Validation

**Feature**: `004-result-restart-validation` | **Date**: 2026-06-02

Two new endpoints are introduced. One existing endpoint (`GET /rooms/:code/game`) has its
status-guard broadened. All other Scenario 1/2/3 endpoints are unchanged.

---

## Modified Endpoint: `GET /rooms/:code/game`

**Change**: The response is now also served when `room.status === "result"`. Previously it
returned `409` for any status other than `"playing"`.

### Updated Status Guard

| Room Status | `currentRound` | Response |
|---|---|---|
| `"playing"` | set | `200 { game: GameSnapshot }` (existing behavior) |
| `"result"` | set | `200 { game: ResultGameSnapshot }` (new) |
| `"lobby"` | null | `409 { message: "Game has not started yet" }` (unchanged) |
| Any | null | `409 { message: "Game has not started yet" }` (unchanged) |

### Result-State Response Shape (`status === "result"`)

```json
{
  "game": {
    "code": "ABCD",
    "status": "result",
    "roundNumber": 1,
    "drawerId": "<uuid>",
    "secretWord": "pizza",
    "participants": [
      { "id": "<uuid>", "name": "Alice", "joinedAt": "2026-06-02T…" },
      { "id": "<uuid>", "name": "Bob",   "joinedAt": "2026-06-02T…" }
    ],
    "strokes": [ [ { "x": 10, "y": 20 }, { "x": 15, "y": 25 } ] ],
    "guesses": [
      {
        "participantId": "<uuid>",
        "text": "pizza",
        "correct": true,
        "submittedAt": "2026-06-02T…"
      }
    ],
    "scores": {
      "<drawer-uuid>": 0,
      "<guesser-uuid>": 100
    }
  }
}
```

**Key difference from playing-state response**: `status` is `"result"` and `secretWord` is
present for ALL participants (not just the drawer).

---

## New Endpoint: `POST /rooms/:code/end`

**Purpose**: Transition the room from `"playing"` to `"result"` status. Host-only action.

**Request**

```
POST /rooms/:code/end
Content-Type: application/json

{
  "participantId": "<uuid>"   // required — must match room.hostId
}
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| `200` | `{ "room": RoomSnapshot }` | Round ended successfully |
| `403` | `{ "message": "Only the host can end the round" }` | `participantId !== room.hostId` |
| `404` | `{ "message": "Room not found" }` | Unknown room code |
| `409` | `{ "message": "Round is not active" }` | `room.status !== "playing"` (includes already-result) |

**Success Response Shape**

```json
{
  "room": {
    "code": "ABCD",
    "hostId": "<uuid>",
    "status": "result",
    "participants": [ … ],
    "availableWords": [ … ],
    "roles": [ … ]
  }
}
```

> Note: The round data (scores, guesses, secretWord) is NOT in the `RoomSnapshot`. Clients
> read those via `GET /rooms/:code/game` (which now serves the result state). The `room`
> response here is sufficient for the frontend to update `roomStore` state.

---

## New Endpoint: `POST /rooms/:code/restart`

**Purpose**: Transition the room from `"result"` back to `"lobby"` and clear all round state.
Participants are preserved. Host-only action.

**Request**

```
POST /rooms/:code/restart
Content-Type: application/json

{
  "participantId": "<uuid>"   // required — must match room.hostId
}
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| `200` | `{ "room": RoomSnapshot }` | Restart completed |
| `403` | `{ "message": "Only the host can restart" }` | `participantId !== room.hostId` |
| `404` | `{ "message": "Room not found" }` | Unknown room code |
| `409` | `{ "message": "Round has not ended" }` | `room.status !== "result"` |

**Success Response Shape**

```json
{
  "room": {
    "code": "ABCD",
    "hostId": "<uuid>",
    "status": "lobby",
    "participants": [
      { "id": "<uuid>", "name": "Alice", "joinedAt": "2026-06-02T…" },
      { "id": "<uuid>", "name": "Bob",   "joinedAt": "2026-06-02T…" }
    ],
    "availableWords": [ … ],
    "roles": [ … ]
  }
}
```

> Note: All round data (`currentRound`, `secretWord`, `drawerId`, `strokes`, `guesses`,
> `scores`) is cleared server-side. The response contains no residual round fields.

---

## Non-Host Redirect Mechanism

After a successful restart, non-host players detect the state change via their existing
`GET /rooms/:code/game` poll:

1. While in result state, the poll returns `200 { game: { status: "result", … } }`.
2. After restart, `currentRound` is `null` and `room.status` is `"lobby"`. The poll returns
   `409 { message: "Game has not started yet" }`.
3. The frontend `GameStore.fetchGame` detects: 409 error received while `game.status` was
   `"result"` → sets `roundEnded: true`.
4. `GamePage` watches `roundEnded` → navigates to `/lobby`.

This requires no new endpoint and no change to the polling interval.

---

## Error Consistency Table

All four Scenario 4 guard conditions produce the same error codes as their Scenario 2/3
counterparts:

| Guard | Code | Message |
|---|---|---|
| Unknown room | `404` | `"Room not found"` |
| Not host | `403` | `"Only the host can …"` |
| Wrong room state | `409` | `"Round is not active"` / `"Round has not ended"` |
| Wrong room state (canvas/guess during result) | `409` | `"Game has not started yet"` (existing guard, no change) |
