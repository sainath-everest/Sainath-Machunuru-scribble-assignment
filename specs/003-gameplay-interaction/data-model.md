# Data Model: Gameplay Interaction (Scenario 3)

All changes in this document are **additive only** — no existing Scenario 1 or Scenario 2
fields are renamed, removed, or re-typed.

---

## Backend — `backend/src/models/game.ts`

### New types

```typescript
// One point in a freehand stroke
export interface StrokePoint {
  x: number;
  y: number;
}

// One pen-down → pen-up movement; an ordered array of points
export type Stroke = StrokePoint[];

// One accepted guess record (appended to Round.guesses)
export interface Guess {
  participantId: string;
  text: string;       // trimmed before storage
  correct: boolean;
  submittedAt: string; // ISO-8601
}
```

### `Round` — extended (was Scenario 2)

```typescript
export interface Round {
  roundNumber: number;
  drawerId: string;
  secretWord: string;
  // NEW ↓
  strokes: Stroke[];                   // append-only; emptied on clear
  guesses: Guess[];                    // append-only
  scores: Record<string, number>;      // participantId → cumulative score (starts 0)
}
```

### `GameSnapshotBase` — extended (was Scenario 2)

```typescript
export interface GameSnapshotBase {
  code: string;
  status: "playing";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
  // NEW ↓
  strokes: Stroke[];
  guesses: Guess[];
  scores: Record<string, number>;
}
```

`DrawerGameSnapshot`, `GuesserGameSnapshot`, and `GameSnapshot` union are unchanged —
the discriminator (`secretWord` present/absent) is preserved from Scenario 2.

---

## Backend — `backend/src/services/roomStore.ts`

### `startGame` — additive extension

Initialize the three new `Round` fields when the round is created:

```typescript
room.currentRound = {
  roundNumber: 1,
  drawerId,
  secretWord,
  strokes: [],
  guesses: [],
  scores: Object.fromEntries(room.participants.map((p) => [p.id, 0]))
};
```

### `toGameSnapshot` — additive extension

Include the new fields in both drawer and guesser snapshots:

```typescript
const base = {
  code: room.code,
  status: "playing" as const,
  roundNumber: round.roundNumber,
  drawerId: round.drawerId,
  participants: room.participants.map((p) => ({ ...p })),
  strokes: round.strokes.map((stroke) => stroke.map((pt) => ({ ...pt }))),
  guesses: round.guesses.map((g) => ({ ...g })),
  scores: { ...round.scores }
};
// secretWord conditional unchanged from Scenario 2
```

### New service functions

```typescript
// POST /rooms/:code/canvas/stroke
export function addStroke(code: string, participantId: string, points: StrokePoint[]) {
  // 1. Look up room; return null if missing
  // 2. Throw HttpError(409, "Game has not started yet") if !room.currentRound
  // 3. Throw HttpError(403, "Only the drawer can modify the canvas")
  //    if participantId !== room.currentRound.drawerId
  // 4. Append { ...points } to room.currentRound.strokes
  // 5. Persist via rooms.set; return { room: cloneRoom(room) }
}

// DELETE /rooms/:code/canvas
export function clearCanvas(code: string, participantId: string) {
  // 1. Look up room; return null if missing
  // 2. Throw HttpError(409, "Game has not started yet") if !room.currentRound
  // 3. Throw HttpError(403, "Only the drawer can modify the canvas")
  //    if participantId !== room.currentRound.drawerId
  // 4. Set room.currentRound.strokes = []
  // 5. Persist via rooms.set; return { room: cloneRoom(room) }
}

// POST /rooms/:code/guess
export function submitGuess(code: string, participantId: string, text: string) {
  // 1. Look up room; return null if room missing
  // 2. Throw HttpError(409, "Game has not started yet") if !room.currentRound
  // 3. const trimmed = text.trim()
  //    Throw HttpError(400, "Guess cannot be empty") if trimmed === ""
  // 4. Throw HttpError(403, "Drawer cannot submit guesses")
  //    if participantId === room.currentRound.drawerId
  // 5. Throw HttpError(404, "Participant not found")
  //    if !room.participants.some(p => p.id === participantId)
  // 6. const correct = trimmed.toLowerCase() === room.currentRound.secretWord.toLowerCase()
  // 7. if (correct && room.currentRound.scores[participantId] === 0)
  //      room.currentRound.scores[participantId] = 100
  // 8. room.currentRound.guesses.push({ participantId, text: trimmed, correct, submittedAt: now() })
  // 9. Persist via rooms.set; return { room: cloneRoom(room) }
}
```

---

## Backend — `backend/src/api/schemas.ts`

### New Zod schemas

```typescript
export const canvasStrokeSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required"),
  points: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(1, "Stroke must contain at least one point")
});

export const canvasClearSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export const guessSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required"),
  text: z
    .string({ required_error: "Guess text is required" })
    .min(1, "Guess text is required")
});
```

---

## Backend — `backend/src/api/rooms.ts`

### New routes

```typescript
// POST /rooms/:code/canvas/stroke
router.post("/:code/canvas/stroke", (req, res, next) => {
  const { code } = roomCodeParamsSchema.parse(req.params);
  const { participantId, points } = canvasStrokeSchema.parse(req.body);
  const result = addStroke(code.toUpperCase(), participantId, points);
  if (!result) throw new HttpError(404, "Unable to load room");
  res.json({ game: toGameSnapshot(result.room, participantId) });
});

// DELETE /rooms/:code/canvas
router.delete("/:code/canvas", (req, res, next) => {
  const { code } = roomCodeParamsSchema.parse(req.params);
  const { participantId } = canvasClearSchema.parse(req.body);
  const result = clearCanvas(code.toUpperCase(), participantId);
  if (!result) throw new HttpError(404, "Unable to load room");
  res.json({ game: toGameSnapshot(result.room, participantId) });
});

// POST /rooms/:code/guess
router.post("/:code/guess", (req, res, next) => {
  const { code } = roomCodeParamsSchema.parse(req.params);
  const { participantId, text } = guessSchema.parse(req.body);
  const result = submitGuess(code.toUpperCase(), participantId, text);
  if (!result) throw new HttpError(404, "Unable to load room");
  res.json({ game: toGameSnapshot(result.room, participantId) });
});
```

---

## Frontend — `frontend/src/services/api.ts`

### New / extended types

```typescript
export interface StrokePoint { x: number; y: number; }
export type Stroke = StrokePoint[];

export interface GuessEntry {
  participantId: string;
  text: string;
  correct: boolean;
  submittedAt: string;
}

// GameSnapshotBase extended:
export interface GameSnapshotBase {
  code: string;
  status: "playing";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
  strokes: Stroke[];
  guesses: GuessEntry[];
  scores: Record<string, number>;
}
// GameSnapshot union type unchanged: GameSnapshotBase & { secretWord?: string }
```

### New api methods

```typescript
submitStroke(code: string, participantId: string, points: StrokePoint[]) {
  return request<{ game: GameSnapshot }>(
    `/rooms/${encodeURIComponent(code)}/canvas/stroke`,
    { method: "POST", body: JSON.stringify({ participantId, points }) }
  );
},
clearCanvas(code: string, participantId: string) {
  return request<{ game: GameSnapshot }>(
    `/rooms/${encodeURIComponent(code)}/canvas`,
    { method: "DELETE", body: JSON.stringify({ participantId }) }
  );
},
submitGuess(code: string, participantId: string, text: string) {
  return request<{ game: GameSnapshot }>(
    `/rooms/${encodeURIComponent(code)}/guess`,
    { method: "POST", body: JSON.stringify({ participantId, text }) }
  );
}
```

---

## Frontend — `frontend/src/state/gameStore.ts`

### New store methods (additive only)

```typescript
async submitStroke(code: string, participantId: string, points: StrokePoint[]) {
  try {
    const response = await api.submitStroke(code, participantId, points);
    this.setState({ game: response.game, error: null });
    return response.game;
  } catch (error) { /* set error, return null */ }
}

async clearCanvas(code: string, participantId: string) {
  try {
    const response = await api.clearCanvas(code, participantId);
    this.setState({ game: response.game, error: null });
    return response.game;
  } catch (error) { /* set error, return null */ }
}

async submitGuess(code: string, participantId: string, text: string) {
  try {
    const response = await api.submitGuess(code, participantId, text);
    this.setState({ game: response.game, error: null });
    return response.game;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit guess";
    this.setState({ error: message });
    return null;
  }
}
```

---

## Frontend — New & Updated Components

### New: `frontend/src/components/DrawingCanvas.tsx`

| Prop | Type | Description |
|------|------|-------------|
| `isDrawer` | `boolean` | Enables pointer input; disables if false |
| `strokes` | `Stroke[]` | Current strokes from `game.strokes`; re-rendered on change |
| `code` | `string` | Room code for API calls |
| `participantId` | `string` | Passed to canvas API endpoints |

**Drawer behaviour**: On `mousedown` → `mousemove` → `mouseup`, accumulate `{x, y}` points
(scaled to canvas coordinate space). On `mouseup`, call `gameStore.submitStroke(...)` with
the completed point array. Renders a "Clear Canvas" button that calls
`gameStore.clearCanvas(...)`.

**Guesser behaviour**: Canvas is rendered read-only. Re-renders `strokes` from game state on
every poll. No pointer events handled.

**Rendering approach**: On mount and on `strokes` change, clear the canvas context and
replay all strokes in order — `moveTo` for the first point of each stroke, `lineTo` for
subsequent points, `stroke()` to commit.

### Updated: `frontend/src/components/GuessForm.tsx`

Receives `code` and `participantId` as props (currently takes none).
On submit: trims input, rejects empty with inline error, calls
`gameStore.submitGuess(code, participantId, text)`, clears the input on success.
Displays the server error (e.g., 403, 400) as an inline message when the store error is set.

### Updated: `frontend/src/components/Scoreboard.tsx`

Currently a static placeholder. Receives `scores: Record<string, number>` and
`participants: Participant[]` as props. Renders one row per participant: name + score.
Sorted by score descending.

### Updated: `frontend/src/components/ResultPanel.tsx`

Currently a static placeholder. Receives `guesses: GuessEntry[]` and
`participants: Participant[]` as props. Renders one entry per guess in submission order:
participant name, guess text, and a ✓/✗ indicator for correct/incorrect.

### Updated: `frontend/src/pages/GamePage.tsx`

- Replace `<div className="canvas-placeholder">` with `<DrawingCanvas>` passing
  `isDrawer`, `strokes={game.strokes}`, `code={room.code}`, `participantId`.
- Pass `code` and `participantId` to `<GuessForm>`.
- Pass `scores={game.scores}` and `participants={game.participants}` to `<Scoreboard>`.
- Pass `guesses={game.guesses}` and `participants={game.participants}` to `<ResultPanel>`.
- Null-guard all new game fields (they are `[]` / `{}` before first poll).
