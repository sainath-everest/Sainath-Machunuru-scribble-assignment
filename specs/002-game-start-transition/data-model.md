# Data Model: Game Start Transition

**Feature**: 002-game-start-transition
**Date**: 2026-06-01

---

## Backend TypeScript Interfaces (`backend/src/models/game.ts`)

### Change 1 — Widen `RoomStatus`

```ts
// Before (Scenario 1)
export type RoomStatus = "lobby";

// After (Scenario 2)
export type RoomStatus = "lobby" | "playing";
```

### Change 2 — Add `Round` interface

```ts
// New — stored server-side only; never serialized into any shared snapshot
export interface Round {
  roundNumber: number;  // always 1 in Scenario 2
  drawerId: string;     // participantId of the drawer
  secretWord: string;   // word the drawer must draw — NEVER in shared snapshots
}
```

### Change 3 — Extend `Room` with `currentRound`

```ts
// Before
export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

// After
export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  currentRound: Round | null;   // null in lobby; set when game starts
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}
```

### Change 4 — `RoomSnapshot` status field is now wider (no new fields added)

```ts
// RoomSnapshot is unchanged except status now resolves to "lobby" | "playing"
// drawerId and secretWord are NOT added here — they live in GameSnapshot only
export interface RoomSnapshot {
  code: string;
  hostId: string;
  status: RoomStatus;          // now "lobby" | "playing"
  participants: Participant[];
  availableWords: string[];
  roles: ParticipantRole[];
}
```

### Change 5 — New `GameSnapshot` interfaces

```ts
// Shared base — always present in GET /rooms/:code/game responses
export interface GameSnapshotBase {
  code: string;
  status: "playing";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
}

// Drawer view — secretWord included
export type DrawerGameSnapshot = GameSnapshotBase & { secretWord: string };

// Guesser view — secretWord absent
export type GuesserGameSnapshot = GameSnapshotBase;

// Union exported for route handler typing
export type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot;
```

---

## Backend Service Changes (`backend/src/services/roomStore.ts`)

### New function — `startGame`

```ts
export function startGame(code: string, participantId: string):
  | { room: Room; round: Round }
  | null  // room not found
```

Logic:
1. Look up `room = rooms.get(code.toUpperCase())`.
2. If not found → `return null`.
3. If `room.status === "playing"` → throw `HttpError(409, "Game already started")`.
4. If caller `participantId !== room.hostId` → throw `HttpError(403, "Only the host can start the game")`.
5. If `room.participants.length < 2` → throw `HttpError(400, "Need at least 2 players to start")`.
6. Pick `drawerId`:
   - `const hostStillPresent = room.participants.some(p => p.id === room.hostId)`
   - `drawerId = hostStillPresent ? room.hostId : room.participants[0].id`
7. Pick `secretWord`:
   - `secretWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)]`
8. Build `round: Round = { roundNumber: 1, drawerId, secretWord }`.
9. Mutate room: `room.status = "playing"; room.currentRound = round; room.updatedAt = now()`.
10. Persist: `rooms.set(room.code, room)`.
11. Return `{ room: cloneRoom(room), round }`.

### New function — `toGameSnapshot`

```ts
export function toGameSnapshot(room: Room, viewerParticipantId?: string): GameSnapshot
```

Logic:
1. Assert `room.currentRound !== null` (caller ensures this).
2. Build base: `{ code, status: "playing", roundNumber, drawerId, participants }`.
3. If `viewerParticipantId === room.currentRound.drawerId` → spread `secretWord` into response.
4. Otherwise → return base without `secretWord`.

---

## Backend Zod Schemas (`backend/src/api/schemas.ts`)

### New — `startRoomSchema`

```ts
export const startRoomSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});
```

### New — `gameViewerQuerySchema` (for GET /rooms/:code/game)

```ts
export const gameViewerQuerySchema = z.object({
  participantId: z.string().optional()
});
```

---

## Backend Route Additions (`backend/src/api/rooms.ts`)

```
POST /rooms/:code/start  →  startGame(code, participantId) → 200 GameSnapshotBase
GET  /rooms/:code/game   →  toGameSnapshot(room, participantId?) → 200 GameSnapshot
```

Both routes added to the existing `createRoomsRouter()` function. No existing routes touched.

---

## Frontend Type Changes (`frontend/src/services/api.ts`)

### Widen `RoomSnapshot.status`

```ts
// Before
export interface RoomSnapshot {
  code: string;
  hostId: string;
  status: "lobby";
  ...
}

// After
export interface RoomSnapshot {
  code: string;
  hostId: string;
  status: "lobby" | "playing";
  ...
}
```

### New — `GameSnapshot` type

```ts
export interface GameSnapshotBase {
  code: string;
  status: "playing";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
}

export type GameSnapshot = GameSnapshotBase & { secretWord?: string };
```

> `secretWord` is optional (`string | undefined`) on the frontend type — it is present in
> the drawer's response and absent in the guesser's. Using `| undefined` is the idiomatic
> TypeScript representation of an omitted JSON field.

### New API methods

```ts
export const api = {
  // ... existing methods unchanged ...

  startGame(code: string, participantId: string) {
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/start`, {
      method: "POST",
      body: JSON.stringify({ participantId })
    });
  },

  fetchGameState(code: string, participantId?: string) {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/game${query}`);
  }
};
```

---

## New Frontend State Store (`frontend/src/state/gameStore.ts`)

Follows the identical `useSyncExternalStore` + class pattern as `roomStore.ts`.

```ts
export interface GameState {
  game: GameSnapshot | null;
  participantId: string | null;
  error: string | null;
  isLoading: boolean;
}
```

Key methods:
- `setGameSession(game, participantId)` — called after successful `startGame`
- `fetchGame()` — calls `api.fetchGameState(game.code, participantId)` and updates state
- `reset()` — sets `game: null` (used when navigating back)

Exports: `GameStoreProvider`, `useGameStore`, `useGameState`

---

## Frontend Page Changes

### `LobbyPage.tsx` — Two additions only

1. **`startGame` handler**: Replace the current `onClick={() => navigate("/game")}` with an
   async handler that calls `api.startGame(room.code, participantId)`, sets the game session
   in `gameStore`, then navigates. Shows inline error on failure.

2. **Poll redirect for non-hosts**: In the existing `setInterval` callback, after
   `roomStore.fetchRoom()` returns, check if `room.status === "playing"` and call
   `navigate("/game")`.

   ```ts
   // inside the existing setInterval callback
   const updated = await roomStore.fetchRoom();
   if (updated?.status === "playing") {
     navigate("/game");
   }
   ```

No other lobby logic is changed.

### `GamePage.tsx` — Full replacement of data source

Currently reads from `roomStore` (which has no game state). Replace with `gameStore`:
- On mount: start polling `gameStore.fetchGame()` every 2s via `setInterval`.
- Derive `isDrawer = game.drawerId === participantId`.
- **Drawer view**: show a "Secret word: `{game.secretWord}`" banner above the canvas.
- **Guesser view**: banner absent; shows "Waiting for drawer…" canvas placeholder.
- Participant list and room code badge read from `game.participants` and `game.code`.
- Exit Game navigates back to `/lobby`.

---

## State Transition Diagram

```
Room lifecycle:
  [created] → status: "lobby"  → POST /rooms/:code/start → status: "playing"
                                                              ↓
                                                     currentRound: { roundNumber:1, drawerId, secretWord }

Endpoint routing per status:
  status: "lobby"   → clients poll GET /rooms/:code      → RoomSnapshot (no game data)
  status: "playing" → clients poll GET /rooms/:code/game → GameSnapshot (secretWord conditional)
  status: "playing" → GET /rooms/:code still works       → RoomSnapshot with status: "playing" (no game data)
```

---

## Scenario 1 Non-Regression Guarantee

| Scenario 1 Endpoint | Change in Scenario 2 |
|---|---|
| `POST /rooms` | None |
| `POST /rooms/:code/join` | None |
| `GET /rooms/:code` | `status` field value may be `"playing"` — no new fields |
| `RoomSnapshot` type | `status` widened from `"lobby"` to `"lobby" \| "playing"` — additive |
| `roomStore.ts` frontend | No changes to existing methods |
| `LobbyPage.tsx` | Two targeted additions only (see above) |
