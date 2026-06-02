# Data Model: Result, Restart & Final Validation

**Feature**: `004-result-restart-validation` | **Date**: 2026-06-02

All changes are **additive**. No Scenario 1, 2, or 3 type is removed or modified in a
breaking way. Existing callers continue to compile unchanged.

---

## Backend — `backend/src/models/game.ts`

### `RoomStatus` — extend union

```diff
- export type RoomStatus = "lobby" | "playing";
+ export type RoomStatus = "lobby" | "playing" | "result";
```

**Impact**: Every place that uses `RoomStatus` now accepts `"result"`. The `Room.status`
field, `RoomSnapshot.status`, and all service-function guards pick this up automatically.

---

### `GameSnapshotBase` — broaden status literal

```diff
  export interface GameSnapshotBase {
    code: string;
-   status: "playing";
+   status: "playing" | "result";
    roundNumber: number;
    drawerId: string;
    participants: Participant[];
    strokes: Stroke[];
    guesses: Guess[];
    scores: Record<string, number>;
  }
```

---

### New `ResultGameSnapshot` type

```typescript
// Returned by GET /rooms/:code/game when room.status === "result".
// secretWord is visible to ALL participants in result state.
export type ResultGameSnapshot = Omit<GameSnapshotBase, "status"> & {
  status: "result";
  secretWord: string;
};
```

---

### Updated `GameSnapshot` union

```diff
  export type DrawerGameSnapshot = GameSnapshotBase & { secretWord: string };
  export type GuesserGameSnapshot = GameSnapshotBase;
- export type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot;
+ export type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot | ResultGameSnapshot;
```

---

### `Room` — no new fields

`Room.currentRound` remains `Round | null`. In `"result"` status, `currentRound` is populated
(preserved for result display). It is only set to `null` during the restart transition.

---

## Backend — `backend/src/services/roomStore.ts`

### `toGameSnapshot` — updated logic

```typescript
export function toGameSnapshot(room: Room, viewerParticipantId?: string): GameSnapshot {
  const round = room.currentRound;

  if (!round) {
    throw new HttpError(409, "Game has not started yet");
  }

  const base = {
    code: room.code,
    status: room.status as "playing" | "result",
    roundNumber: round.roundNumber,
    drawerId: round.drawerId,
    participants: room.participants.map((p) => ({ ...p })),
    strokes: round.strokes.map((s) => s.map((pt) => ({ ...pt }))),
    guesses: round.guesses.map((g) => ({ ...g })),
    scores: { ...round.scores }
  };

  // In result state: secretWord visible to ALL participants.
  if (room.status === "result") {
    return { ...base, status: "result" as const, secretWord: round.secretWord };
  }

  // In playing state: existing drawer-only secretWord rule is unchanged.
  if (viewerParticipantId === round.drawerId) {
    return { ...base, status: "playing" as const, secretWord: round.secretWord };
  }

  return { ...base, status: "playing" as const };
}
```

### New `endRound` service function

```typescript
export function endRound(code: string, participantId: string) {
  const room = rooms.get(code.toUpperCase());

  if (!room) throw new HttpError(404, "Room not found");
  if (participantId !== room.hostId)
    throw new HttpError(403, "Only the host can end the round");
  if (room.status !== "playing")
    throw new HttpError(409, "Round is not active");

  room.status = "result";
  room.updatedAt = now();
  rooms.set(room.code, room);

  return { room: cloneRoom(room) };
}
```

### New `restartGame` service function

```typescript
export function restartGame(code: string, participantId: string) {
  const room = rooms.get(code.toUpperCase());

  if (!room) throw new HttpError(404, "Room not found");
  if (participantId !== room.hostId)
    throw new HttpError(403, "Only the host can restart");
  if (room.status !== "result")
    throw new HttpError(409, "Round has not ended");

  room.status = "lobby";
  room.currentRound = null;      // clears secretWord, drawerId, strokes, guesses, scores
  room.updatedAt = now();
  rooms.set(room.code, room);

  return { room: cloneRoom(room) };
  // room.participants is untouched — all players preserved
}
```

---

## Backend — `backend/src/api/schemas.ts`

### New schemas (no existing schema changed)

```typescript
export const endRoundSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export const restartSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});
```

---

## Backend — `backend/src/api/rooms.ts`

### `GET /:code/game` — updated status guard

```diff
- if (room.status !== "playing" || !room.currentRound) {
+ if ((room.status !== "playing" && room.status !== "result") || !room.currentRound) {
    throw new HttpError(409, "Game has not started yet");
  }
```

### New `POST /:code/end` route

```typescript
router.post("/:code/end", (request, response, next) => {
  try {
    const { code } = roomCodeParamsSchema.parse(request.params);
    const { participantId } = endRoundSchema.parse(request.body);
    const result = endRound(code, participantId);
    response.json({ room: toRoomSnapshot(result.room) });
  } catch (error) {
    next(error);
  }
});
```

### New `POST /:code/restart` route

```typescript
router.post("/:code/restart", (request, response, next) => {
  try {
    const { code } = roomCodeParamsSchema.parse(request.params);
    const { participantId } = restartSchema.parse(request.body);
    const result = restartGame(code, participantId);
    response.json({ room: toRoomSnapshot(result.room) });
  } catch (error) {
    next(error);
  }
});
```

---

## Frontend — `frontend/src/services/api.ts`

### `RoomSnapshot.status` — extend union

```diff
  export interface RoomSnapshot {
    code: string;
    hostId: string;
-   status: "lobby" | "playing";
+   status: "lobby" | "playing" | "result";
    participants: Participant[];
    availableWords: string[];
    roles: ParticipantRole[];
  }
```

### `GameSnapshotBase.status` — broaden literal

```diff
  export interface GameSnapshotBase {
    code: string;
-   status: "playing";
+   status: "playing" | "result";
    ...
  }
```

### `GameSnapshot` — add result variant

```diff
- export type GameSnapshot = GameSnapshotBase & { secretWord?: string };
+ // "playing": secretWord present only for drawer (may be absent)
+ // "result": secretWord always present for all participants
+ export type GameSnapshot =
+   | (GameSnapshotBase & { status: "playing"; secretWord?: string })
+   | (GameSnapshotBase & { status: "result"; secretWord: string });
```

### New API methods

```typescript
endRound(code: string, participantId: string) {
  return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/end`, {
    method: "POST",
    body: JSON.stringify({ participantId })
  });
},
restartGame(code: string, participantId: string) {
  return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/restart`, {
    method: "POST",
    body: JSON.stringify({ participantId })
  });
}
```

---

## Frontend — `frontend/src/state/gameStore.ts`

### `GameState` — new `roundEnded` flag

```diff
  export interface GameState {
    game: GameSnapshot | null;
    error: string | null;
    isLoading: boolean;
+   roundEnded: boolean;
  }
```

**Semantics**: `roundEnded` is `false` at initialization and during gameplay. It flips to
`true` when:
1. `fetchGame` receives a 409 error AND `this.state.game?.status === "result"` (poll-detected
   restart — covers non-host players).
2. `restartGame` completes successfully (covers the host).

`GamePage` watches `roundEnded` and navigates to `/lobby` when it becomes `true`.

### Updated `fetchGame` method

```typescript
async fetchGame(code: string, participantId?: string) {
  this.setState({ isLoading: true });
  try {
    const response = await api.fetchGameState(code, participantId);
    this.setState({ game: response.game, error: null, isLoading: false });
    return response.game;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load game state";
    // If the poll 409s while we were in result state, the host has restarted.
    const wasInResultState = this.state.game?.status === "result";
    this.setState({
      error: message,
      isLoading: false,
      ...(wasInResultState ? { roundEnded: true } : {})
    });
    return null;
  }
}
```

### New `endRound` method

```typescript
async endRound(code: string, participantId: string) {
  try {
    const response = await api.endRound(code, participantId);
    // room snapshot returned; game state is refreshed on next poll
    return response.room;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end round";
    this.setState({ error: message });
    return null;
  }
}
```

### New `restartGame` method

```typescript
async restartGame(code: string, participantId: string) {
  try {
    const response = await api.restartGame(code, participantId);
    this.setState({ game: null, error: null, roundEnded: true });
    return response.room;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restart";
    this.setState({ error: message });
    return null;
  }
}
```

### `reset` — clear `roundEnded`

```diff
  reset() {
-   this.setState({ game: null, error: null, isLoading: false });
+   this.setState({ game: null, error: null, isLoading: false, roundEnded: false });
  }
```

---

## Frontend — `frontend/src/components/ResultScreen.tsx` (NEW FILE)

```typescript
interface ResultScreenProps {
  secretWord: string;
  scores: Record<string, number>;
  participants: Participant[];
  guesses: GuessEntry[];
  isHost: boolean;
  isRestarting: boolean;
  onRestart: () => void;
}
```

Renders three sections (no canvas):
1. **Secret Word** — prominent heading showing the revealed word.
2. **Final Scores** — `<Scoreboard>` with participants sorted descending by score. No winner
   label — scores are displayed neutrally.
3. **Guess History** — `<ResultPanel>` showing all guesses in chronological order.

Below the sections:
- "Restart" button: visible and enabled only when `isHost === true`. Non-host participants
  do not see the button.

---

## Frontend — `frontend/src/pages/GamePage.tsx` (UPDATED)

### New state and refs

```typescript
const { game, error: gameError, roundEnded } = useGameState();
const [isEndingRound, setIsEndingRound] = useState(false);
const [isRestarting, setIsRestarting] = useState(false);
```

### Redirect on `roundEnded`

```typescript
useEffect(() => {
  if (roundEnded) {
    gameStore.reset();
    navigate("/lobby", { replace: true });
  }
}, [roundEnded, gameStore, navigate]);
```

### End Round handler (host only)

```typescript
const handleEndRound = useCallback(async () => {
  if (!room || !participantId) return;
  setIsEndingRound(true);
  await gameStore.endRound(room.code, participantId);
  setIsEndingRound(false);
  // Game poll will pick up status: "result" on next cycle
}, [room, participantId, gameStore]);
```

### Restart handler (host only, result screen)

```typescript
const handleRestart = useCallback(async () => {
  if (!room || !participantId) return;
  setIsRestarting(true);
  const updatedRoom = await gameStore.restartGame(room.code, participantId);
  if (updatedRoom) {
    roomStore.setRoomSnapshot(updatedRoom);
  }
  setIsRestarting(false);
  // roundEnded will be true → useEffect navigates to /lobby
}, [room, participantId, gameStore, roomStore]);
```

### Conditional render

```typescript
const isHost = participantId === room.hostId;

if (game?.status === "result") {
  return (
    <ResultScreen
      secretWord={game.secretWord}
      scores={game.scores}
      participants={game.participants}
      guesses={game.guesses}
      isHost={isHost}
      isRestarting={isRestarting}
      onRestart={handleRestart}
    />
  );
}

// Existing game layout — unchanged
// End Round button rendered for host only inside game layout:
{isHost && (
  <button
    className="button button--secondary"
    onClick={handleEndRound}
    disabled={isEndingRound}
  >
    {isEndingRound ? "Ending…" : "End Round"}
  </button>
)}
```
