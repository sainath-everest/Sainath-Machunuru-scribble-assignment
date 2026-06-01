---
description: "Task list for Gameplay Interaction (Scenario 3)"
---

# Tasks: Gameplay Interaction

**Input**: Design documents from `specs/003-gameplay-interaction/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/gameplay-api.md ✅ | research.md ✅

**Tests**: Unit test tasks are included for all three new service functions and the three new
Zod schemas, consistent with the testing strategy established in Scenarios 1 and 2.

**Organization**: Tasks are grouped by user story (US1–US4 from `spec.md`), preceded by a
Setup phase and a Foundational phase. All Scenario 1 and Scenario 2 files are untouched
except for the two additive extensions to `roomStore.ts` and `game.ts` in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel — touches a different file than all other current in-flight tasks
- **[Story]**: User story this task belongs to (US1–US4)
- Exact file paths are included in every task description

## Path Conventions

- Backend source: `backend/src/`
- Frontend source: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Verify the Scenario 2 baseline is green before any Scenario 3 changes begin.

- [ ] T001 [P] Run `cd backend && npm run build` — confirm zero TypeScript errors
- [ ] T002 [P] Run `cd frontend && npm run build` — confirm zero TypeScript errors
- [ ] T003 [P] Run `cd backend && npm test` — confirm all 26 Scenario 1 + 2 tests pass

**Checkpoint**: All three pass green — safe to begin Phase 2.

---

## Phase 2: Foundational — Backend Model Extension (Strictly Sequential)

**Purpose**: Extend the backend data model and the two shared service functions that all
user story phases build on. All tasks in this phase touch `backend/src/models/game.ts` or
`backend/src/services/roomStore.ts` and MUST run in order.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete and the
backend build is green.

- [ ] T004 Add `StrokePoint` interface (`x: number; y: number`) and `Stroke` type
  (`StrokePoint[]`) to `backend/src/models/game.ts` — place after the `Guess` import block,
  above the `Round` interface

- [ ] T005 Add `Guess` interface to `backend/src/models/game.ts`:
  ```ts
  export interface Guess {
    participantId: string;
    text: string;
    correct: boolean;
    submittedAt: string;
  }
  ```

- [ ] T006 Extend the `Round` interface in `backend/src/models/game.ts` with three new fields
  (additive only — do NOT remove `roundNumber`, `drawerId`, `secretWord`):
  ```ts
  strokes: Stroke[];
  guesses: Guess[];
  scores: Record<string, number>;
  ```

- [ ] T007 Extend `GameSnapshotBase` in `backend/src/models/game.ts` with the same three
  new fields (additive only):
  ```ts
  strokes: Stroke[];
  guesses: Guess[];
  scores: Record<string, number>;
  ```

- [ ] T008 Extend `startGame` in `backend/src/services/roomStore.ts` — add the three new
  `Round` fields when the round object is created (single-line additions inside the existing
  object literal):
  ```ts
  strokes: [],
  guesses: [],
  scores: Object.fromEntries(room.participants.map((p) => [p.id, 0]))
  ```

- [ ] T009 Extend `toGameSnapshot` in `backend/src/services/roomStore.ts` — spread the
  three new fields into the `base` object (additive only; `secretWord` conditional unchanged):
  ```ts
  strokes: round.strokes.map((stroke) => stroke.map((pt) => ({ ...pt }))),
  guesses: round.guesses.map((g) => ({ ...g })),
  scores: { ...round.scores }
  ```

**Checkpoint**: Run `cd backend && npm run build` — zero TypeScript errors required before
Phase 3 begins.

---

## Phase 3: US1 (P1) — Drawer Draws and Clears the Canvas

**Goal**: The drawer can freehand-draw on an HTML5 canvas and clear it. Completed strokes
are sent per-stroke to the server and stored. Guessers see the current drawing via polling.

**Independent Test**: Open two tabs. Tab A (drawer): draw strokes and confirm
`POST /rooms/:code/canvas/stroke` requests fire on pen-lift. Tab A: click "Clear Canvas"
and confirm `DELETE /rooms/:code/canvas` fires. Tab B (guesser): confirm strokes appear
within ~2s; confirm canvas is blank after clear.

### Backend (T010–T014, sequential within roomStore.ts then rooms.ts)

- [ ] T010 [US1] Add `addStroke(code: string, participantId: string, points: StrokePoint[])` to
  `backend/src/services/roomStore.ts`:
  - Look up room; return `null` if not found
  - Throw `HttpError(409, "Game has not started yet")` if `!room.currentRound`
  - Throw `HttpError(403, "Only the drawer can modify the canvas")` if
    `participantId !== room.currentRound.drawerId`
  - Push `[...points]` (deep copy) to `room.currentRound.strokes`
  - Persist with `rooms.set(room.code, room)`; return `{ room: cloneRoom(room) }`

- [ ] T011 [US1] Add `clearCanvas(code: string, participantId: string)` to
  `backend/src/services/roomStore.ts`:
  - Look up room; return `null` if not found
  - Throw `HttpError(409, "Game has not started yet")` if `!room.currentRound`
  - Throw `HttpError(403, "Only the drawer can modify the canvas")` if
    `participantId !== room.currentRound.drawerId`
  - Set `room.currentRound.strokes = []`
  - Persist with `rooms.set(room.code, room)`; return `{ room: cloneRoom(room) }`

- [ ] T012 [P] [US1] Add `canvasStrokeSchema` and `canvasClearSchema` to
  `backend/src/api/schemas.ts` (parallel with T010–T011 — different file):
  ```ts
  export const canvasStrokeSchema = z.object({
    participantId: z.string({ required_error: "Participant ID is required" })
      .trim().min(1, "Participant ID is required"),
    points: z.array(z.object({ x: z.number(), y: z.number() }))
      .min(1, "Stroke must contain at least one point")
  });
  export const canvasClearSchema = z.object({
    participantId: z.string({ required_error: "Participant ID is required" })
      .trim().min(1, "Participant ID is required")
  });
  ```

- [ ] T013 [US1] Add `POST /:code/canvas/stroke` route to `createRoomsRouter` in
  `backend/src/api/rooms.ts` (after T010, T012):
  - Parse params with `roomCodeParamsSchema`, body with `canvasStrokeSchema`
  - Call `addStroke(code.toUpperCase(), participantId, points)`
  - If `null` → throw `HttpError(404, "Unable to load room")`
  - Respond `200` with `{ game: toGameSnapshot(result.room, participantId) }`

- [ ] T014 [US1] Add `DELETE /:code/canvas` route to `createRoomsRouter` in
  `backend/src/api/rooms.ts` (after T011, T013 — same file):
  - Parse params with `roomCodeParamsSchema`, body with `canvasClearSchema`
  - Call `clearCanvas(code.toUpperCase(), participantId)`
  - If `null` → throw `HttpError(404, "Unable to load room")`
  - Respond `200` with `{ game: toGameSnapshot(result.room, participantId) }`

### Backend Unit Tests (T015–T016, parallelizable — different files)

- [ ] T015 [P] [US1] Add `addStroke` and `clearCanvas` unit tests to
  `backend/src/services/roomStore.test.ts` in a new `describe("addStroke")` and
  `describe("clearCanvas")` block:
  - `addStroke` happy path: stroke appended to `currentRound.strokes`
  - `addStroke` 403: non-drawer `participantId` throws "Only the drawer can modify the canvas"
  - `addStroke` 409: game not started throws "Game has not started yet"
  - `addStroke` null: unknown room code returns `null`
  - `clearCanvas` happy path: `currentRound.strokes` becomes `[]`
  - `clearCanvas` 403: non-drawer `participantId` throws
  - `clearCanvas` 409: game not started throws

- [ ] T016 [P] [US1] Add `canvasStrokeSchema` and `canvasClearSchema` unit tests to
  `backend/src/api/schemas.test.ts`:
  - `canvasStrokeSchema` accepts valid body
  - `canvasStrokeSchema` rejects missing `participantId`
  - `canvasStrokeSchema` rejects empty `points` array
  - `canvasClearSchema` accepts valid body
  - `canvasClearSchema` rejects missing `participantId`

### Frontend (T017–T020)

- [ ] T017 [P] [US1] Extend `frontend/src/services/api.ts` (parallel with backend — different project):
  - Add `export interface StrokePoint { x: number; y: number; }`
  - Add `export type Stroke = StrokePoint[];`
  - Extend `GameSnapshotBase` to add `strokes: Stroke[]` field
  - Add `submitStroke(code, participantId, points: StrokePoint[])` api method:
    ```ts
    return request<{ game: GameSnapshot }>(
      `/rooms/${encodeURIComponent(code)}/canvas/stroke`,
      { method: "POST", body: JSON.stringify({ participantId, points }) }
    );
    ```
  - Add `clearCanvas(code, participantId)` api method:
    ```ts
    return request<{ game: GameSnapshot }>(
      `/rooms/${encodeURIComponent(code)}/canvas`,
      { method: "DELETE", body: JSON.stringify({ participantId }) }
    );
    ```

- [ ] T018 [P] [US1] Add `submitStroke` and `clearCanvas` methods to `GameStore` in
  `frontend/src/state/gameStore.ts` (parallel with backend tests — different file):
  ```ts
  async submitStroke(code: string, participantId: string, points: StrokePoint[]) {
    try {
      const response = await api.submitStroke(code, participantId, points);
      this.setState({ game: response.game, error: null });
      return response.game;
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : "Failed to submit stroke" });
      return null;
    }
  }
  async clearCanvas(code: string, participantId: string) {
    try {
      const response = await api.clearCanvas(code, participantId);
      this.setState({ game: response.game, error: null });
      return response.game;
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : "Failed to clear canvas" });
      return null;
    }
  }
  ```
  Import `StrokePoint` from `../services/api`.

- [ ] T019 [US1] Create `frontend/src/components/DrawingCanvas.tsx` (new file):
  - Props: `isDrawer: boolean`, `strokes: Stroke[]`, `code: string`, `participantId: string`
  - Ref a `<canvas>` element at a fixed size (e.g., 600×400 or CSS-sized)
  - **Render effect** (`useEffect` on `strokes`): clear context → for each stroke, `ctx.beginPath()`, `ctx.moveTo(stroke[0].x, stroke[0].y)`, `ctx.lineTo(pt.x, pt.y)` for subsequent points, `ctx.stroke()`
  - **Drawer pointer handling** (`isDrawer === true`): `onMouseDown` → start accumulating `{x, y}` points (relative to canvas bounds via `getBoundingClientRect`); `onMouseMove` (while pressed) → push point and draw live segment; `onMouseUp` → call `gameStore.submitStroke(code, participantId, accumulatedPoints)` → reset accumulator
  - **Clear button**: rendered only when `isDrawer`; `onClick` → `gameStore.clearCanvas(code, participantId)`
  - **Guesser mode** (`isDrawer === false`): no pointer event handlers; canvas is read-only; same `strokes` render effect re-draws on each prop change
  - Import `useGameStore` from `../state/gameStore` and `type Stroke, type StrokePoint` from `../services/api`

- [ ] T020 [US1] Update `frontend/src/pages/GamePage.tsx`:
  - Import `DrawingCanvas` from `../components/DrawingCanvas`
  - Replace the existing `<Card title="Canvas"><div className="canvas-placeholder">…</div></Card>` with:
    ```tsx
    <Card title="Canvas">
      <DrawingCanvas
        isDrawer={isDrawer}
        strokes={game?.strokes ?? []}
        code={room.code}
        participantId={participantId ?? ""}
      />
    </Card>
    ```

**Checkpoint US1**: Run `cd backend && npm run build && npm test`; run `cd frontend && npm run build`. Then manually verify drawer/guesser canvas sync per `quickstart.md` Steps 3–6.

---

## Phase 4: US2 (P1) — Guesser Submits a Validated Guess

**Goal**: Guessers can submit text guesses. Empty guesses are rejected client-side. The
server trims, compares case-insensitively, scores 100 on first correct guess (cap at one
scoring event per participant), and returns the updated `GameSnapshot` immediately.

**Independent Test**: As guesser: submit empty → client error, no network request. Submit
"WORD" for correct secret word → score shows 100 immediately. Submit wrong word → score 0.
Submit "WORD" again → score stays 100 (no double-score). Drawer submits → 403.

### Backend (T021–T023, sequential within roomStore.ts then rooms.ts)

- [ ] T021 [US2] Add `submitGuess(code: string, participantId: string, text: string)` to
  `backend/src/services/roomStore.ts`:
  - Look up room; return `null` if not found
  - Throw `HttpError(409, "Game has not started yet")` if `!room.currentRound`
  - `const trimmed = text.trim()`
  - Throw `HttpError(400, "Guess cannot be empty")` if `trimmed === ""`
  - Throw `HttpError(403, "Drawer cannot submit guesses")` if
    `participantId === room.currentRound.drawerId`
  - Throw `HttpError(404, "Participant not found")` if
    `!room.participants.some((p) => p.id === participantId)`
  - `const correct = trimmed.toLowerCase() === room.currentRound.secretWord.toLowerCase()`
  - If `correct && room.currentRound.scores[participantId] === 0`:
    `room.currentRound.scores[participantId] = 100`
  - Push `{ participantId, text: trimmed, correct, submittedAt: now() }` to
    `room.currentRound.guesses`
  - Persist with `rooms.set(room.code, room)`; return `{ room: cloneRoom(room) }`

- [ ] T022 [P] [US2] Add `guessSchema` to `backend/src/api/schemas.ts` (parallel with T021 — different file):
  ```ts
  export const guessSchema = z.object({
    participantId: z.string({ required_error: "Participant ID is required" })
      .trim().min(1, "Participant ID is required"),
    text: z.string({ required_error: "Guess text is required" })
      .min(1, "Guess text is required")
  });
  ```

- [ ] T023 [US2] Add `POST /:code/guess` route to `createRoomsRouter` in
  `backend/src/api/rooms.ts` (after T021, T022 — same file as T013/T014):
  - Parse params with `roomCodeParamsSchema`, body with `guessSchema`
  - Call `submitGuess(code.toUpperCase(), participantId, text)`
  - If `null` → throw `HttpError(404, "Unable to load room")`
  - Respond `200` with `{ game: toGameSnapshot(result.room, participantId) }`

### Backend Unit Tests (T024–T025, parallelizable — different files)

- [ ] T024 [P] [US2] Add `submitGuess` unit tests to `backend/src/services/roomStore.test.ts`
  in a new `describe("submitGuess")` block:
  - Happy path correct guess: `correct: true`, `scores[participantId] = 100`
  - Case-insensitive match: "PIZZA" matches "pizza"
  - Whitespace trim: "  pizza  " matches "pizza"
  - Incorrect guess: `correct: false`, score unchanged
  - Score cap: second correct submission adds 0 (score stays 100, entry recorded as `correct: true`)
  - Empty trimmed text: throws "Guess cannot be empty"
  - Drawer blocked: throws "Drawer cannot submit guesses"
  - Unknown participantId: throws "Participant not found"
  - Game not started: throws "Game has not started yet"
  - Unknown room: returns `null`

- [ ] T025 [P] [US2] Add `guessSchema` unit tests to `backend/src/api/schemas.test.ts`:
  - Accepts valid `{ participantId, text }`
  - Rejects missing `participantId`
  - Rejects blank `participantId`
  - Rejects missing `text`

### Frontend (T026–T029, sequential within api.ts then gameStore.ts then components)

- [ ] T026 [P] [US2] Extend `frontend/src/services/api.ts` (parallel with backend tests — different project):
  - Add `export interface GuessEntry { participantId: string; text: string; correct: boolean; submittedAt: string; }`
  - Extend `GameSnapshotBase` to add `guesses: GuessEntry[]` and `scores: Record<string, number>`
  - Add `submitGuess(code, participantId, text)` api method:
    ```ts
    return request<{ game: GameSnapshot }>(
      `/rooms/${encodeURIComponent(code)}/guess`,
      { method: "POST", body: JSON.stringify({ participantId, text }) }
    );
    ```

- [ ] T027 [P] [US2] Add `submitGuess` method to `GameStore` in
  `frontend/src/state/gameStore.ts` (parallel with backend tests — different file):
  ```ts
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
  Import `GuessEntry` from `../services/api`.

- [ ] T028 [US2] Update `frontend/src/components/GuessForm.tsx`:
  - Change signature to accept `code: string` and `participantId: string` props
  - Import `useGameStore` from `../state/gameStore`
  - Add `const [guessError, setGuessError] = useState<string | null>(null)`
  - In `handleSubmit`: trim input → if empty, `setGuessError("Guess cannot be empty")` and return (no network call) → else call `await gameStore.submitGuess(code, participantId, guessText.trim())` → on success clear input and `setGuessError(null)` → on failure display store error via `setGuessError`
  - Render `{guessError ? <p className="form__error">{guessError}</p> : null}` below the input

- [ ] T029 [US2] Update `frontend/src/pages/GamePage.tsx`:
  - Add `code={room.code}` and `participantId={participantId ?? ""}` props to `<GuessForm>`
    (the `<GuessForm>` is already rendered conditionally for non-drawers; just add the props)

**Checkpoint US2**: Run builds + tests. Manually verify all guess guard cases per `quickstart.md` Steps 7–12.

---

## Phase 5: US3 (P1) — Guess History Synced to All Players

**Goal**: Every accepted guess is visible in the guess history panel for all players
(drawer and guessers) within ~2s of submission. The panel shows participant name, guess
text, and a correct/incorrect indicator.

**Independent Test**: From two tabs, submit 3 guesses. On both tabs, confirm all 3 entries
appear within ~2s with correct name, text, and ✓/✗ indicator.

> Note: The backend already returns `guesses` in every `GET /rooms/:code/game` response
> (extended in Phase 2 + T021). This phase adds the frontend rendering only.

- [ ] T030 [US3] Update `frontend/src/components/ResultPanel.tsx`:
  - Change signature to accept `guesses: GuessEntry[]` and `participants: Participant[]` props
  - Import `GuessEntry` from `../services/api` and `Participant` from `../services/api`
  - Replace the static placeholder with a rendered list:
    - If `guesses.length === 0`: display "No guesses yet."
    - For each guess: look up participant name via `participants.find(p => p.id === g.participantId)?.name ?? "Unknown"`
    - Render: `<span>{name}</span>` + `<span>{guess.text}</span>` + a correct/incorrect badge
      (`✓` in green or `✗` in red based on `guess.correct`)
    - Use a simple `<ul>` / `<li>` structure with CSS class `guess-history`

- [ ] T031 [US3] Update `frontend/src/pages/GamePage.tsx`:
  - Pass `guesses={game?.guesses ?? []}` and `participants={game?.participants ?? []}` to `<ResultPanel>`

**Checkpoint US3**: Both tabs see all guesses within ~2s per `quickstart.md` Step 13.

---

## Phase 6: US4 (P2) — Scoreboard Shows Live Scores

**Goal**: All participants' scores are displayed in the scoreboard from the first poll.
All scores start at 0 and update within ~2s of a correct guess.

**Independent Test**: At round start, all scores are 0 on both tabs. After one correct
guess, the guesser's score shows 100 on both tabs within ~2s.

> Note: Scores are already returned in `GET /rooms/:code/game` (Phase 2 + Phase 4 backend).
> This phase adds the frontend rendering only.

- [ ] T032 [US4] Update `frontend/src/components/Scoreboard.tsx`:
  - Change signature to accept `scores: Record<string, number>` and `participants: Participant[]` props
  - Import `Participant` from `../services/api`
  - Replace the static placeholder with a rendered list:
    - Build entries: `participants.map(p => ({ name: p.name, score: scores[p.id] ?? 0 }))`
    - Sort entries descending by `score`
    - Render as `<ul>` with one `<li>` per entry: participant name + score
    - Use CSS class `scoreboard-list` for styling

- [ ] T033 [US4] Update `frontend/src/pages/GamePage.tsx`:
  - Pass `scores={game?.scores ?? {}}` and `participants={game?.participants ?? []}` to `<Scoreboard>`

**Checkpoint US4**: Confirm all 4 US4 acceptance scenarios per `quickstart.md` Step 14 browser test.

---

## Phase 7: Polish & Validation

**Purpose**: Confirm all Scenario 3 changes compile, all unit tests pass (including
Scenarios 1 and 2 regression), and end-to-end acceptance criteria are verified.

- [ ] T034 [P] Run `cd backend && npm run build` — zero TypeScript errors
- [ ] T035 [P] Run `cd frontend && npm run build` — zero TypeScript errors
- [ ] T036 [P] Run `cd backend && npm test` — all unit tests pass (Scenarios 1, 2, and 3)
- [ ] T037 Complete manual 14-step validation following `specs/003-gameplay-interaction/quickstart.md` Steps 1–14

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (T001–T003, all parallel)
    ↓
Phase 2 (T004 → T005 → T006 → T007 → T008 → T009, strictly sequential — same files)
    ↓ backend build checkpoint
    ↓
Phase 3 (US1 backend → US1 frontend)
    ↓ build + test checkpoint
    ↓
Phase 4 (US2 backend → US2 frontend)
    ↓ build + test checkpoint
    ↓
Phase 5 (US3 frontend only — 2 tasks)
    ↓
Phase 6 (US4 frontend only — 2 tasks)
    ↓
Phase 7 (validation — 4 tasks)
```

### Within Phase 3 (US1)

```
T010 (addStroke)      T012 [P] (schemas)    T017 [P] (api.ts FE)
     ↓                      ↓                     ↓
T011 (clearCanvas)    T016 [P] (schema tests) T018 [P] (gameStore FE)
     ↓                      ↓                     ↓
T015 [P] (svc tests) T013 (POST /stroke route)    T019 (DrawingCanvas)
                            ↓                     ↓
                       T014 (DELETE /canvas)  T020 (GamePage)
```

### Within Phase 4 (US2)

```
T021 (submitGuess svc)   T022 [P] (guessSchema)  T026 [P] (api.ts FE)
        ↓                       ↓                       ↓
T024 [P] (svc tests)    T025 [P] (schema tests)  T027 [P] (gameStore FE)
                                ↓                       ↓
                           T023 (POST /guess)       T028 (GuessForm)
                                                        ↓
                                                   T029 (GamePage)
```

### `GamePage.tsx` Edit Sequence (strictly sequential — same file)

```
T020 (Phase 3: DrawingCanvas) → T029 (Phase 4: GuessForm props)
    → T031 (Phase 5: ResultPanel props) → T033 (Phase 6: Scoreboard props)
```

---

## Parallel Opportunities

### Phase 3 — US1

- Backend (`addStroke`/`clearCanvas` in roomStore.ts) and frontend (`StrokePoint`/`Stroke` types + api methods in api.ts) touch different projects — run in parallel after T009
- Schema work (`canvasStrokeSchema`, `canvasClearSchema` in schemas.ts) is independent of service work

### Phase 4 — US2

- `guessSchema` (schemas.ts) is independent of `submitGuess` service (roomStore.ts) — parallel
- Frontend `api.ts` / `gameStore.ts` extension is independent of backend work — parallel
- Unit test files (roomStore.test.ts, schemas.test.ts) can be written in parallel once their subjects are complete

### Phase 7

- Build commands and test run are independent shell commands — parallel

---

## Implementation Strategy

### MVP First (Phases 1–3: US1 — drawing canvas)

1. Phase 1: Verify Scenario 2 baseline
2. Phase 2: Backend model — CRITICAL, blocks everything
3. Phase 3: US1 — canvas drawing (backend + frontend)
4. **STOP and VALIDATE** — drawer draws, guesser sees strokes via poll; clear canvas works

### Incremental Delivery (Phases 4–6)

5. Phase 4: US2 — guess submission with scoring
6. **VALIDATE** — guesser scores 100; second correct guess stays at 100; drawer blocked
7. Phase 5: US3 — guess history display (frontend only, 2 tasks)
8. Phase 6: US4 — scoreboard display (frontend only, 2 tasks)
9. Phase 7: Final validation

---

## Notes

- `[P]` means a different file is touched with no pending dependencies — safe to parallelize within a phase
- Tasks without `[P]` in the same phase MUST run sequentially
- `GamePage.tsx` is modified four times across Phases 3–6 (T020, T029, T031, T033) — strictly sequential
- The scoring cap rule (`scores[participantId] === 0` check before incrementing) is enforced in `submitGuess` (T021), NOT in the frontend — never add client-side score arithmetic
- `strokes`, `guesses`, `scores` are returned to ALL callers via `GET /rooms/:code/game` and all three new endpoints' responses — no role-specific filtering on these fields
- Do NOT modify any Scenario 1 or Scenario 2 files except: `game.ts` (T004–T007), `roomStore.ts` (T008–T011, T021), `schemas.ts` (T012, T022), `rooms.ts` (T013, T014, T023), `api.ts` (T017, T026), `gameStore.ts` (T018, T027)
- No Scenario 4 concepts (end-of-round state, result screen, restart, winner calculation, round reset) are introduced anywhere in this task list
