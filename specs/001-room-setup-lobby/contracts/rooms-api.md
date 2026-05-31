# API Contracts: Rooms

**Feature**: `001-room-setup-lobby`
**Base URL**: `http://localhost:3001`
**Content-Type**: `application/json` (all requests and responses)

---

## Shared Types

### `Participant`
```json
{
  "id": "string (UUID)",
  "name": "string (non-empty, trimmed)",
  "joinedAt": "string (ISO 8601)"
}
```

### `RoomSnapshot`
```json
{
  "code": "string (4-char alphanumeric)",
  "hostId": "string (UUID — participantId of the room creator)",
  "status": "\"lobby\"",
  "participants": "[Participant]",
  "availableWords": "[string]",
  "roles": "[\"drawer\" | \"guesser\"]"
}
```

> `hostId` is **new** in Scenario 1. The client uses it to determine whether the current
> player is the host by comparing `room.hostId === participantId`.

### `RoomSessionResponse`
```json
{
  "participantId": "string (UUID — identity of the joining player)",
  "room": "RoomSnapshot"
}
```

---

## `POST /rooms` — Create Room

Creates a new room and registers the caller as the first participant and host.

### Request

```json
{
  "playerName": "string (required, non-empty after trim)"
}
```

**Validation**:
- `playerName` MUST be a non-empty string after whitespace trimming.
- Empty or whitespace-only `playerName` returns HTTP 400.

### Response — `201 Created`

```json
{
  "participantId": "PPPP-...",
  "room": {
    "code": "ABCD",
    "hostId": "PPPP-...",
    "status": "lobby",
    "participants": [
      { "id": "PPPP-...", "name": "Alice", "joinedAt": "2026-06-01T00:00:00.000Z" }
    ],
    "availableWords": ["rocket", "pizza", "castle", "guitar", "sunflower"],
    "roles": ["drawer", "guesser"]
  }
}
```

> `hostId` in the snapshot equals the `participantId` in the response — the creator is
> always their own host.

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400` | `playerName` is empty or whitespace-only | `{ "message": "Player name is required" }` |
| `400` | Request body malformed / missing | `{ "message": "Invalid request payload" }` |

---

## `POST /rooms/:code/join` — Join Room

Adds a new participant to an existing room.

### Path Parameter

| Parameter | Type | Notes |
|-----------|------|-------|
| `code` | string | Case-insensitive; normalised to uppercase before lookup |

### Request

```json
{
  "playerName": "string (required, non-empty after trim)"
}
```

### Response — `200 OK`

```json
{
  "participantId": "QQQQ-...",
  "room": {
    "code": "ABCD",
    "hostId": "PPPP-...",
    "status": "lobby",
    "participants": [
      { "id": "PPPP-...", "name": "Alice", "joinedAt": "2026-06-01T00:00:00.000Z" },
      { "id": "QQQQ-...", "name": "Bob",   "joinedAt": "2026-06-01T00:00:01.000Z" }
    ],
    "availableWords": ["rocket", "pizza", "castle", "guitar", "sunflower"],
    "roles": ["drawer", "guesser"]
  }
}
```

> `hostId` remains `"PPPP-..."` (the original creator). The joiner's `participantId`
> is `"QQQQ-..."`. The joiner can compare them to confirm they are not the host.

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400` | `playerName` is empty or whitespace-only | `{ "message": "Player name is required" }` |
| `404` | Room code does not match any active room | `{ "message": "Unable to join room" }` |
| `400` | Malformed payload | `{ "message": "Invalid request payload" }` |

---

## `GET /rooms/:code` — Fetch Room Snapshot

Returns the current state of a room. Used by the lobby polling loop.

### Path Parameter

| Parameter | Type | Notes |
|-----------|------|-------|
| `code` | string | Case-insensitive; normalised to uppercase |

### Query Parameter

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `participantId` | string (UUID) | No | Passed by the client to identify the viewer; not used in Scenario 1 |

### Response — `200 OK`

```json
{
  "room": {
    "code": "ABCD",
    "hostId": "PPPP-...",
    "status": "lobby",
    "participants": [
      { "id": "PPPP-...", "name": "Alice", "joinedAt": "2026-06-01T00:00:00.000Z" },
      { "id": "QQQQ-...", "name": "Bob",   "joinedAt": "2026-06-01T00:00:01.000Z" }
    ],
    "availableWords": ["rocket", "pizza", "castle", "guitar", "sunflower"],
    "roles": ["drawer", "guesser"]
  }
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Room code does not match any active room | `{ "message": "Unable to load room" }` |

---

## `GET /health` — Health Check (unchanged)

```json
{ "ok": true }
```

---

## Contract Change Summary (vs. Starter)

| Endpoint | Change |
|----------|--------|
| `POST /rooms` | `playerName` now required (was optional); `room.hostId` added to response |
| `POST /rooms/:code/join` | `playerName` now required; `room.hostId` added to response |
| `GET /rooms/:code` | `room.hostId` added to response |
| `GET /health` | Unchanged |
