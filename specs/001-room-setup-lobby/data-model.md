# Data Model: Room Setup & Lobby

**Feature**: `001-room-setup-lobby`
**Date**: 2026-06-01

---

## Backend Models (`backend/src/models/game.ts`)

### Current → Required Changes

#### `RoomStatus` (unchanged)

```ts
// Scenario 1 only supports "lobby" status. No change to this type.
export type RoomStatus = "lobby";
```

#### `Room` (add `hostId`)

```ts
export interface Room {
  code: string;
  hostId: string;        // ← NEW: participantId of the room creator; immutable after creation
  status: RoomStatus;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}
```

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `code` | `string` | 4 chars, alphanumeric, unique | Existing field |
| `hostId` | `string` | UUID; matches a `Participant.id` in `participants` | NEW — set once in `createRoom` |
| `status` | `RoomStatus` | always `"lobby"` in Scenario 1 | Existing field; unchanged |
| `participants` | `Participant[]` | min 1 after creation | Existing field |
| `createdAt` | `string` | ISO 8601 | Existing field |
| `updatedAt` | `string` | ISO 8601 | Existing field |

#### `RoomSnapshot` (add `hostId`)

```ts
export interface RoomSnapshot {
  code: string;
  hostId: string;        // ← NEW: always present; clients use this to determine host role
  status: RoomStatus;
  participants: Participant[];
  availableWords: string[];
  roles: ParticipantRole[];
}
```

| Field | Type | Notes |
|-------|------|-------|
| `code` | `string` | Existing field |
| `hostId` | `string` | NEW — included in every response |
| `status` | `RoomStatus` | Existing field |
| `participants` | `Participant[]` | Existing field |
| `availableWords` | `string[]` | Existing field (starter seed) |
| `roles` | `ParticipantRole[]` | Existing field (starter seed) |

#### `Participant` (unchanged)

```ts
export interface Participant {
  id: string;       // UUID
  name: string;     // trimmed, non-empty
  joinedAt: string; // ISO 8601
}
```

#### `RoomSessionResponse` (unchanged)

```ts
export interface RoomSessionResponse {
  participantId: string;
  room: RoomSnapshot;   // now includes hostId
}
```

---

## Backend Service Changes (`backend/src/services/roomStore.ts`)

### `createRoom`

```ts
export function createRoom(playerName?: string) {
  const participant = createParticipant(playerName);
  const room: Room = {
    code: generateUniqueCode(),
    hostId: participant.id,   // ← NEW
    status: "lobby",
    participants: [participant],
    createdAt: now(),
    updatedAt: now()
  };
  rooms.set(room.code, room);
  return { room: cloneRoom(room), participantId: participant.id };
}
```

### `toRoomSnapshot`

```ts
export function toRoomSnapshot(room: Room, viewerParticipantId?: string): RoomSnapshot {
  void viewerParticipantId;  // not used in Scenario 1
  return {
    code: room.code,
    hostId: room.hostId,   // ← NEW
    status: room.status,
    participants: room.participants.map((p) => ({ ...p })),
    availableWords: listWords(),
    roles: [...STARTER_ROLES]
  };
}
```

---

## Backend Validation Changes (`backend/src/api/schemas.ts`)

```ts
export const createRoomSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(1, "Player name is required")  // ← was optional(); now required + trimmed
});

export const joinRoomSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(1, "Player name is required")  // ← was optional(); now required + trimmed
});

// roomCodeParamsSchema and roomViewerQuerySchema are unchanged
```

**Validation rules**:
- `playerName`: MUST be a non-empty string after trimming whitespace. A name of `"   "`
  is rejected with message "Player name is required".
- Room code: validated by `roomCodeParamsSchema` (existing `z.string()`); normalised to
  uppercase in route handlers before lookup.

---

## Frontend Type Changes (`frontend/src/services/api.ts`)

```ts
export interface RoomSnapshot {
  code: string;
  hostId: string;        // ← NEW: mirrors backend RoomSnapshot
  status: "lobby";
  participants: Participant[];
  availableWords: string[];
  roles: ParticipantRole[];
}
```

---

## Frontend State Model (`frontend/src/state/roomStore.ts`)

No structural changes to `RoomStore` or `RoomState`. The existing `room: RoomSnapshot | null`
field now carries `hostId` automatically once the type is updated. The lobby derives
`isHost` by comparing `room.hostId` to the store's `participantId`.

```
isHost  = room.hostId === participantId
canStart = isHost && room.participants.length >= 2
```

---

## State Transitions (Scenario 1 scope)

```
[Start Screen]
     │
     ├─ Create Room → POST /rooms → Room created (status: "lobby", hostId set)
     │                             → Navigate to /lobby
     │
     └─ Join Room   → POST /rooms/:code/join → Participant added to room
                                              → Navigate to /lobby

[Lobby Screen]
     │  ← setInterval polling GET /rooms/:code every ~2s
     │
     ├─ Poll updates participant list + hostId in UI
     │
     └─ Host clicks Start Game (≥2 players) → Navigate host to /game
        Non-host: remains in lobby (Start Game button hidden/disabled for them)
```

---

## Data Flow: Who Knows What

| Data point | Backend source | Included in snapshot? | Frontend consumer |
|------------|---------------|----------------------|------------------|
| Room code | `Room.code` | ✅ | Lobby: display badge |
| Host identity | `Room.hostId` | ✅ NEW | Lobby: "Host" label; Start Game gate |
| Participant list | `Room.participants` | ✅ | Lobby: participant list |
| Viewer identity | Client `participantId` | Not in snapshot (client-held) | Lobby: derive `isHost` |
| Room status | `Room.status` | ✅ | Not used in Scenario 1 UI (always `"lobby"`) |
