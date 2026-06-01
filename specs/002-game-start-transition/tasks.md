---
description: "Task list for Game Start Transition (Scenario 2)"
---

# Tasks: Game Start Transition

**Input**: Design documents from `specs/002-game-start-transition/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/rooms-api.md ✅ | research.md ✅

**Tests**: Unit test tasks are included for role assignment and word visibility rules as explicitly
requested. Manual integration validation is covered by `quickstart.md`.

**Organization**: Tasks are grouped by user story (US1–US4 from `spec.md`), with a Foundational
phase that unblocks all stories. All Scenario 1 files and tasks are untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel — touches a different file than all other current in-flight tasks
- **[Story]**: User story this task belongs to (US1–US4)
- Exact file paths are included in every task description

## Path Conventions

- Backend source: `backend/src/`
- Frontend source: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Verify the Scenario 1 baseline is green before any Scenario 2 changes begin.

- [ ] T001 [P] Verify backend builds: run `cd backend && npm run build` — resolve any pre-existing TypeScript errors
- [ ] T002 [P] Verify frontend builds: run `cd frontend && npm run build` — resolve any pre-existing TypeScript errors

**Checkpoint**: Both builds green — safe to start Phase 2.

---

## Phase 2: Foundational — Backend Model (Strictly Sequential)

**Purpose**: Extend the backend data model with `Round`, `currentRound`, and `GameSnapshot` types.
All four tasks touch `backend/src/models/game.ts` and MUST run in order. T005 introduces
`currentRound: Round | null` on `Room`, which immediately causes a TypeScript error in
`roomStore.ts`; T006 patches it before any build checkpoint.

- [ ] T003 Widen `RoomStatus` from literal `"lobby"` to `"lobby" | "playing"` in `backend/src/models/game.ts`
- [ ] T004 Add `Round` interface (`roundNumber: number`, `drawerId: string`, `secretWord: string`) to `backend/src/models/game.ts` — this type is server-side only and must never be serialized into any shared snapshot
- [ ] T005 Add `currentRound: Round | null` field to the `Room` interface in `backend/src/models/game.ts` — `null` represents lobby state; a `Round` object represents the active playing state
- [ ] T006 Add `GameSnapshotBase` interface and `DrawerGameSnapshot` (extends base with `secretWord: string`), `GuesserGameSnapshot` (base only), and `GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot` union type to `backend/src/models/game.ts`
- [ ] T007 Fix TypeScript error introduced by T005: add `currentRound: null` to the room object literal inside `createRoom` in `backend/src/services/roomStore.ts`

> T007 is a one-line patch. It is placed here (not in Phase 3) because the build CANNOT pass
> until both T005 (model change) and T007 (service patch) are applied together.

**Checkpoint**: Run `cd backend && npm run build` — zero TypeScript errors required before any
user-story phase begins.

---

## Phase 3: US1 (P1) + US3 (P1) — Game Start Transition & Drawer Assignment

**Goal**: The host can start the game via `POST /rooms/:code/start`. The call validates the caller
is the host, enforces the 2-player minimum, rejects double-starts, assigns the drawer
(host preferred; first participant by join-order as fallback), selects a word at random from
`STARTER_WORDS`, and transitions the room to `"playing"`.

**Independent Test**: Two-tab create + join. Call `POST /rooms/:code/start` with host's
`participantId`. Confirm server returns `200`, room status is `"playing"`, and a `currentRound`
exists with `drawerId` equal to the host's `participantId`. Then verify the 403/400/409 guard
responses per `quickstart.md` Steps 7–9.

### Backend Implementation (T008–T010, strictly sequential on `roomStore.ts` then `rooms.ts`)

- [ ] T008 [US1] Add `startGame(code: string, participantId: string)` to `backend/src/services/roomStore.ts`:
  - Look up room; return `null` if not found
  - Throw `HttpError(409, "Game already started")` if `room.status === "playing"`
  - Throw `HttpError(403, "Only the host can start the game")` if `participantId !== room.hostId`
  - Throw `HttpError(400, "Need at least 2 players to start")` if `room.participants.length < 2`
  - Set `drawerId = room.hostId` if host is in participant list, else `drawerId = room.participants[0].id`
  - Set `secretWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)]`
  - Mutate: `room.status = "playing"`, `room.currentRound = { roundNumber: 1, drawerId, secretWord }`, `room.updatedAt = now()`
  - Persist with `rooms.set(room.code, room)` and return `{ room: cloneRoom(room) }`

- [ ] T009 [P] [US1] Add `startRoomSchema` to `backend/src/api/schemas.ts`:
  ```
  z.object({ participantId: z.string({ required_error: "Participant ID is required" }).trim().min(1, "Participant ID is required") })
  ```

- [ ] T010 [US1] Add `POST /:code/start` route to the `createRoomsRouter` function in `backend/src/api/rooms.ts`:
  - Parse params with `roomCodeParamsSchema`, body with `startRoomSchema`
  - Call `startGame(code.toUpperCase(), participantId)`
  - If `null`, throw `HttpError(404, "Unable to load room")`
  - On success, respond `200` with `{ room: toRoomSnapshot(result.room) }`

> T009 can run in parallel with T008 (different file). T010 must follow both T008 and T009.

### Backend Unit Tests (T011–T012, parallelizable — different files)

- [ ] T011 [P] [US1] [US3] Add `startGame` unit tests to `backend/src/services/roomStore.test.ts`:
  - Happy path: `startGame` returns a room with `status: "playing"` and `currentRound` set
  - Drawer rule — host present: `drawerId` equals the host's `participantId`
  - Drawer rule — host absent: `drawerId` equals `participants[0].id` (the first joiner)
  - Word selection: `currentRound.secretWord` is a member of `STARTER_WORDS`
  - 409 guard: calling `startGame` on a room already in `"playing"` throws with status 409
  - 400 guard: calling `startGame` on a 1-player room throws with status 400
  - 403 guard: calling `startGame` with a non-host `participantId` throws with status 403

- [ ] T012 [P] [US1] Add `startRoomSchema` unit tests to `backend/src/api/schemas.test.ts`:
  - Missing `participantId` throws `"Participant ID is required"`
  - Blank/whitespace-only `participantId` throws `"Participant ID is required"`

### Frontend API Method (T013, parallelizable — different project)

- [ ] T013 [P] [US1] Add `startGame(code: string, participantId: string)` method to `frontend/src/services/api.ts`:
  ```ts
  startGame(code, participantId) {
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/start`, {
      method: "POST",
      body: JSON.stringify({ participantId })
    });
  }
  ```

**Checkpoint**: Run `cd backend && npm test` — all T011/T012 tests pass. US1/US3 backend complete;
frontend wiring deferred to Phase 5.

---

## Phase 4: US2 (P1) — Secret Word Visibility & API Response Masking

**Goal**: `GET /rooms/:code/game` returns a `GameSnapshot`. When `participantId` matches
`drawerId`, `secretWord` is included in the response. For all other callers — non-drawer,
unknown, or absent `participantId` — the `secretWord` field is **absent** (not null, not empty).
Visibility enforcement lives at the API layer, not in the frontend.

**Independent Test**: After starting a game, call `GET /rooms/:code/game?participantId={drawerId}` —
confirm `secretWord` is present. Call with a guesser's `participantId` — confirm `secretWord` is
absent. Call without any `participantId` — confirm `secretWord` is absent. See `quickstart.md`
Steps 4–6.

### Backend Implementation (T014–T016, strictly sequential on `roomStore.ts` then `rooms.ts`)

- [ ] T014 [US2] Add `toGameSnapshot(room: Room, viewerParticipantId?: string): GameSnapshot` to `backend/src/services/roomStore.ts`:
  - Assert `room.currentRound !== null` (only callable in `"playing"` state)
  - Build base: `{ code, status: "playing", roundNumber, drawerId, participants: [...] }`
  - If `viewerParticipantId === room.currentRound.drawerId` → spread `{ secretWord }` into response
  - Otherwise → return base without `secretWord` (field absent, not null)

- [ ] T015 [P] [US2] Add `gameViewerQuerySchema` to `backend/src/api/schemas.ts`:
  ```ts
  z.object({ participantId: z.string().optional() })
  ```

- [ ] T016 [US2] Add `GET /:code/game` route to the `createRoomsRouter` function in `backend/src/api/rooms.ts`:
  - Parse params with `roomCodeParamsSchema`, query with `gameViewerQuerySchema`
  - Look up room with `getRoom(code.toUpperCase())`; throw `HttpError(404, ...)` if not found
  - If `room.status !== "playing"` → throw `HttpError(409, "Game has not started yet")`
  - Call `toGameSnapshot(room, participantId)` and respond `200` with `{ game: snapshot }`

> T015 can run in parallel with T014 (different file). T016 must follow both.

### Backend Unit Tests (T017, parallelizable — different section of existing test file)

- [ ] T017 [P] [US2] Add `toGameSnapshot` unit tests to `backend/src/services/roomStore.test.ts`:
  - Drawer view: calling with drawer's `participantId` returns a snapshot **with** `secretWord` field present and matching `currentRound.secretWord`
  - Guesser view: calling with a non-drawer `participantId` returns a snapshot where `"secretWord" in snapshot === false` (field absent, not null)
  - No-identity view: calling without `participantId` returns a snapshot where `"secretWord" in snapshot === false`

### Frontend Types & State (T018–T020, strictly sequential within frontend)

- [ ] T018 [P] [US2] Add `GameSnapshot` type and `fetchGameState` method to `frontend/src/services/api.ts`:
  ```ts
  // Type
  export interface GameSnapshotBase {
    code: string; status: "playing"; roundNumber: number;
    drawerId: string; participants: Participant[];
  }
  export type GameSnapshot = GameSnapshotBase & { secretWord?: string };
  // API method
  fetchGameState(code, participantId?) {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/game${query}`);
  }
  ```

- [ ] T019 [US2] Create `frontend/src/state/gameStore.ts` (new file) following the exact
  `useSyncExternalStore` + class pattern as `roomStore.ts`:
  - `GameState`: `{ game: GameSnapshot | null; participantId: string | null; error: string | null; isLoading: boolean }`
  - `GameStore` class: `setGameSession(game, participantId)`, `fetchGame()` (calls `api.fetchGameState`), `reset()`
  - Export: `GameStoreProvider` (React provider wrapping `useRef<GameStore>`), `useGameStore`, `useGameState`

- [ ] T020 [US2] Add `<GameStoreProvider>` to the app root in `frontend/src/main.tsx`:
  - Wrap it around (or alongside) the existing `<RoomStoreProvider>` so `useGameStore` is
    available on all routes

### Frontend Game Screen (T021, depends on T019/T020)

- [ ] T021 [US2] Rewrite `frontend/src/pages/GamePage.tsx` to use game state:
  - Replace `useRoomState` import with `useGameState` from `gameStore`
  - Guard: if `game === null`, navigate to `/` and return `null`
  - Add `setInterval` polling `gameStore.fetchGame()` every 2000ms; `clearInterval` on unmount
  - Derive `isDrawer = game.drawerId === game.participantId` (use `participantId` from `useGameState`)
  - **Drawer view**: render a visible "Secret word: `{game.secretWord}`" banner in the Player Info card
  - **Guesser view**: no secret word banner; show "Waiting for drawer to start drawing…" in the canvas placeholder
  - Room code badge reads from `game.code`; participant list reads from `game.participants`

**Checkpoint**: Run `cd frontend && npm run build` — zero TypeScript errors. US2 backend
and frontend complete; verify `secretWord` isolation via `curl` commands in `quickstart.md` Steps 4–6.

---

## Phase 5: US1 Frontend + US4 (P2) — Start Game Trigger & Non-Host Auto-Transition

**Goal**: The host's "Start Game" button calls `POST /rooms/:code/start`, stores the result in
`gameStore`, and navigates to `/game`. Non-host players are automatically redirected to `/game`
on the next poll cycle when `status: "playing"` is detected in the lobby polling response.

**Independent Test**: Two tabs — Tab A (host) clicks Start Game → navigates immediately.
Tab B (non-host) is polling → navigates within ~2s. See `quickstart.md` Steps 3 and 10.

**Note**: Both T022 and T023 modify `frontend/src/pages/LobbyPage.tsx` and MUST run sequentially.

- [ ] T022 [US1] Update `frontend/src/pages/LobbyPage.tsx` — replace the Start Game button's
  `onClick={() => navigate("/game")}` with an async `handleStartGame` function:
  ```ts
  async function handleStartGame() {
    try {
      setStartError(null);
      const response = await api.startGame(room.code, participantId!);
      gameStore.setGameSession(response.room, participantId!);
      navigate("/game");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Unable to start game");
    }
  }
  ```
  Add `const gameStore = useGameStore()` and `const [startError, setStartError] = useState<string | null>(null)`.
  Display `startError` as an inline error near the Start Game button.
  Pass `disabled={!canStart || isStarting}` to the button and track `isStarting` state.

- [ ] T023 [US4] Update `frontend/src/pages/LobbyPage.tsx` — extend the existing `setInterval`
  poll callback to detect game start for non-host players:
  ```ts
  const updated = await roomStore.fetchRoom();
  if (updated?.status === "playing") {
    navigate("/game");
  }
  ```
  This addition goes inside the existing `try` block of the poll callback, immediately after the
  `await roomStore.fetchRoom()` line. No new effects or state required.

**Checkpoint**: US4 complete. Manual test: Tab B auto-navigates to `/game` within ~2s of host
clicking Start Game.

---

## Phase 6: Polish & Validation

**Purpose**: Confirm all Scenario 2 changes compile, all unit tests pass, and end-to-end
acceptance criteria are verified.

- [ ] T024 [P] Run `cd backend && npm run build` — zero TypeScript errors
- [ ] T025 [P] Run `cd frontend && npm run build` — zero TypeScript errors
- [ ] T026 [P] Run `cd backend && npm test` — all unit tests pass (T011, T012, T017 + all Scenario 1 tests)
- [ ] T027 Complete manual two-tab validation following `specs/002-game-start-transition/quickstart.md` Steps 1–10

---

## Execution Order Summary

```
Phase 1 (T001–T002, parallel)
    ↓
Phase 2 (T003 → T004 → T005 → T006 → T007, strictly sequential — all game.ts + one roomStore patch)
    ↓
    ┌─────────────────────────────────────┐
Phase 3 (US1 + US3)          Phase 4 (US2) — can start after Phase 2
    │                                │
T008 (roomStore startGame)      T014 (roomStore toGameSnapshot)
T009 [P] (schemas)               T015 [P] (schemas)
T010 (rooms route)               T016 (rooms route)
T011 [P] (tests)                 T017 [P] (tests)
T012 [P] (tests)                 T018 [P] (api.ts types+method)
T013 [P] (api.ts method)         T019 (gameStore.ts — new file)
    └──────────────┬──────────────T020 (main.tsx provider)
                   ↓
          Phase 5 (US1 frontend + US4)
          T022 → T023 (LobbyPage.tsx, sequential — same file)
          T021 can run in parallel with T022/T023 (GamePage.tsx — different file)
                   ↓
              Phase 6 (T024–T027, polish)
```

**LobbyPage.tsx edit sequence** (sequential, same file):
```
T022 (Phase 5: handleStartGame + startError) → T023 (Phase 5: poll redirect)
```

**Key cross-phase dependency**: T022 requires `useGameStore` which requires T019 (gameStore.ts).
Complete T019–T020 before starting T022.

---

## Implementation Strategy

### MVP First (Phases 1–3: US1 + US3 — game can start)

1. Phase 1: Verify Scenario 1 baseline
2. Phase 2: Backend model — CRITICAL, blocks everything
3. Phase 3: US1 + US3 — backend game-start logic, drawer assignment, unit tests, frontend API method
4. **STOP and VALIDATE** — `POST /rooms/:code/start` works via curl; drawer assignment correct;
   all 7 backend unit tests (T011/T012) pass

### Full Scenario 2 Delivery

5. Phase 4: US2 — secret word visibility enforced at API level, GamePage drawer/guesser split
6. Phase 5: US1 frontend trigger + US4 auto-transition
7. Phase 6: Polish — both builds green, all tests pass, full `quickstart.md` 10-step walkthrough

---

## Notes

- `[P]` means a different file is touched with no pending dependencies — safe to parallelize within a phase
- Tasks without `[P]` in the same phase MUST run sequentially
- `secretWord` enforcement MUST be implemented in `toGameSnapshot` (T014) — the frontend rendering
  in T021 is a display layer only; the API NEVER sends `secretWord` to guessers regardless of
  what the frontend does
- Never start Phase 5 without completing T019/T020 — `useGameStore` is a hard dependency for T022
- Commit after each phase or logical group; reference the task ID in the commit message
  (e.g. `feat: T008 add startGame service`)
- Do NOT modify any Scenario 1 files except the three targeted additions:
  `game.ts` (model extension), `roomStore.ts` (`currentRound: null` in createRoom), `LobbyPage.tsx` (T022/T023)
