# API Contracts: Game Start Transition

**Feature**: 002-game-start-transition
**Date**: 2026-06-01
**Base URL**: `http://localhost:3001`

---

## Existing Endpoints — Unchanged

The following Scenario 1 endpoints are **not modified** by this feature:

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/rooms` | Unchanged |
| `POST` | `/rooms/:code/join` | Unchanged |
| `GET`  | `/rooms/:code` | `status` value may now be `"playing"` — no new fields added |

---

## New Endpoint 1 — Start Game

### `POST /rooms/:code/start`

Transitions a lobby room to playing state, assigns a drawer, and selects a secret word.

**Request**

```
POST /rooms/ABCD/start
Content-Type: application/json

{
  "participantId": "string (UUID of the caller)"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `participantId` | `string` | Yes | Non-empty; must equal `room.hostId` |

**Response — 200 OK** (game started)

```json
{
  "room": {
    "code": "ABCD",
    "hostId": "uuid",
    "status": "playing",
    "participants": [{ "id": "uuid", "name": "Alice", "joinedAt": "ISO8601" }],
    "availableWords": ["rocket", "pizza", "castle", "guitar", "sunflower"],
    "roles": ["drawer", "guesser"]
  }
}
```

> Returns the updated `RoomSnapshot`. `drawerId` and `secretWord` are **not** in this
> response — callers obtain game-phase data from `GET /rooms/:code/game`.

**Error Responses**

| Status | Condition | Body |
|--------|-----------|------|
| `400 Bad Request` | Fewer than 2 participants | `{ "message": "Need at least 2 players to start" }` |
| `400 Bad Request` | `participantId` absent or blank | `{ "message": "Participant ID is required" }` |
| `403 Forbidden` | `participantId` does not equal `room.hostId` | `{ "message": "Only the host can start the game" }` |
| `404 Not Found` | Room code not found | `{ "message": "Unable to load room" }` |
| `409 Conflict` | Room already in `"playing"` status | `{ "message": "Game already started" }` |

---

## New Endpoint 2 — Fetch Game State

### `GET /rooms/:code/game`

Returns the current game state. Conditionally includes `secretWord` based on caller identity.

**Request**

```
GET /rooms/ABCD/game?participantId=<uuid>
```

| Query Param | Type | Required | Notes |
|-------------|------|----------|-------|
| `participantId` | `string` | No | When matching `drawerId`, response includes `secretWord` |

**Response — 200 OK (drawer view)**

```json
{
  "game": {
    "code": "ABCD",
    "status": "playing",
    "roundNumber": 1,
    "drawerId": "uuid-of-drawer",
    "secretWord": "rocket",
    "participants": [
      { "id": "uuid", "name": "Alice", "joinedAt": "ISO8601" },
      { "id": "uuid", "name": "Bob",   "joinedAt": "ISO8601" }
    ]
  }
}
```

**Response — 200 OK (guesser view)**

```json
{
  "game": {
    "code": "ABCD",
    "status": "playing",
    "roundNumber": 1,
    "drawerId": "uuid-of-drawer",
    "participants": [
      { "id": "uuid", "name": "Alice", "joinedAt": "ISO8601" },
      { "id": "uuid", "name": "Bob",   "joinedAt": "ISO8601" }
    ]
  }
}
```

> `secretWord` is **absent** (not `null`) in the guesser response.

**Error Responses**

| Status | Condition | Body |
|--------|-----------|------|
| `404 Not Found` | Room code not found | `{ "message": "Unable to load room" }` |
| `409 Conflict` | Room is still in `"lobby"` status | `{ "message": "Game has not started yet" }` |

---

## Shared Types Reference

### `RoomSnapshot` (updated)

```json
{
  "code": "string (4-char alphanumeric)",
  "hostId": "string (UUID)",
  "status": "\"lobby\" | \"playing\"",
  "participants": "[Participant]",
  "availableWords": "[string]",
  "roles": "[\"drawer\" | \"guesser\"]"
}
```

### `GameSnapshot` — Drawer

```json
{
  "code": "string",
  "status": "\"playing\"",
  "roundNumber": "number",
  "drawerId": "string (UUID)",
  "secretWord": "string",
  "participants": "[Participant]"
}
```

### `GameSnapshot` — Guesser

```json
{
  "code": "string",
  "status": "\"playing\"",
  "roundNumber": "number",
  "drawerId": "string (UUID)",
  "participants": "[Participant]"
}
```

### `Participant`

```json
{
  "id": "string (UUID)",
  "name": "string",
  "joinedAt": "string (ISO 8601)"
}
```

---

## Polling Strategy Summary

| Screen | Endpoint Polled | Interval | Stop Condition |
|--------|-----------------|----------|----------------|
| Lobby | `GET /rooms/:code` | ~2s | Navigate to `/game` when `status: "playing"` |
| Game screen | `GET /rooms/:code/game?participantId=...` | ~2s | Navigate away from `/game` |
