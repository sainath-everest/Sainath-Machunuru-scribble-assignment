# Tasks: Result, Restart & Final Validation

**Input**: Design documents from `specs/004-result-restart-validation/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/result-api.md ✅ | quickstart.md ✅

**Organization**: Grouped by user story — each phase is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no serial dependency)
- **[Story]**: User story this task belongs to (US1/US2/US3)
- Exact file paths required in every task description

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm both builds and all existing tests are green before any Scenario 4 changes.
No Scenario 4 code is written here.

- [X] T001 Verify backend builds cleanly — `cd backend && npm run build` exits 0
- [X] T002 Verify frontend builds cleanly — `cd frontend && npm run build` exits 0
- [X] T003 Verify all backend tests pass — `cd backend && npm test` exits 0 with 0 failures

**Checkpoint**: Both builds green, all tests passing → safe to begin Scenario 4 changes.

---

## Phase 2: Foundational (Result-State Type Layer)

**Purpose**: Extend the shared type definitions on both backend and frontend to recognise
`"result"` as a valid room status. These two tasks MUST be complete before any user story
can be implemented — every subsequent task depends on these types compiling.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Extend `RoomStatus`, `GameSnapshotBase`, add `ResultGameSnapshot` type, and update `GameSnapshot` union in `backend/src/models/game.ts` — see `data-model.md` §Backend `game.ts`
- [X] T005 [P] Mirror type extensions in `frontend/src/services/api.ts`: add `"result"` to `RoomSnapshot.status`, broaden `GameSnapshotBase.status`, replace `GameSnapshot` with discriminated union — see `data-model.md` §Frontend `api.ts`

**Build checkpoint after T004 + T005**: `cd backend && npm run build` must be green before proceeding.

---

## Phase 3: User Story 1 — Host Ends the Round and Result State is Displayed (Priority: P1) 🎯 MVP

**Goal**: The host can trigger "End Round" from the game screen. The room transitions to
`"result"` status. All players see the result state on their next poll cycle without a page reload.

**Independent Test**: Start a round with two tabs. Click "End Round" in the host tab. Confirm
`GET /rooms/:code/game` returns `{ game: { status: "result", secretWord: "…", … } }`. Confirm
both browser tabs transition away from the game screen within ~2s. No manual refresh needed.

### Implementation for User Story 1 — Backend Service

- [X] T006 [US1] Update `toGameSnapshot()` in `backend/src/services/roomStore.ts` to handle `room.status === "result"`: include `secretWord` for all participants and set `status: "result"` in the returned snapshot — see `data-model.md` §`toGameSnapshot`
- [X] T007 [US1] Add `endRound(code, participantId)` service function to `backend/src/services/roomStore.ts`: validate room exists (404), validate host (403), validate `status === "playing"` (409), set `status = "result"`, persist, return `{ room: cloneRoom(room) }` — see `data-model.md` §`endRound`
- [X] T008 [P] [US1] Add `endRoundSchema` to `backend/src/api/schemas.ts`: `{ participantId: string, required, trimmed, min 1 }` — see `data-model.md` §`schemas.ts`

### Implementation for User Story 1 — Backend Tests

- [X] T009 [P] [US1] Add unit tests for `endRound()` in `backend/src/services/roomStore.test.ts`: happy path (playing → result), 404 unknown room, 403 non-host, 409 status is lobby, 409 status is already result
- [X] T010 [P] [US1] Add unit tests for `endRoundSchema` in `backend/src/api/schemas.test.ts`: accepts valid `participantId`, rejects missing field, rejects empty string

### Implementation for User Story 1 — Backend Route

- [X] T011 [US1] Update `GET /:code/game` status guard in `backend/src/api/rooms.ts`: change condition from `room.status !== "playing"` to `(room.status !== "playing" && room.status !== "result")` so the result snapshot is served — see `contracts/result-api.md` §Modified Endpoint
- [X] T012 [US1] Add `POST /:code/end` route to `backend/src/api/rooms.ts`: parse params with `roomCodeParamsSchema`, parse body with `endRoundSchema`, call `endRound()`, return `{ room: toRoomSnapshot(result.room) }` — see `contracts/result-api.md` §New Endpoint

**Backend build + test checkpoint after T012**: `npm run build` and `npm test` must both be green.

### Implementation for User Story 1 — Frontend API + State

- [X] T013 [US1] Add `endRound(code, participantId)` API method to `frontend/src/services/api.ts`: `POST /rooms/:code/end` returning `{ room: RoomSnapshot }` — see `data-model.md` §New API methods
- [X] T014 [US1] Update `frontend/src/state/gameStore.ts`: add `roundEnded: boolean` to `GameState` (default `false`); update `fetchGame` to set `roundEnded: true` when a 409 error arrives while `game.status === "result"`; add `endRound(code, participantId)` method that calls `api.endRound`; update `reset()` to clear `roundEnded` — see `data-model.md` §`gameStore.ts`
- [X] T015 [US1] Update `frontend/src/pages/GamePage.tsx`: destructure `roundEnded` from `useGameState()`; add `useEffect` that navigates to `/lobby` when `roundEnded` flips `true` (calling `gameStore.reset()` first); add `isEndingRound` state; add `handleEndRound` callback that calls `gameStore.endRound()`; render "End Round" button only when `isHost === true` inside the existing `button-row` — see `data-model.md` §`GamePage.tsx`

**Checkpoint**: US1 independently testable — host can click End Round, game poll returns result
snapshot, non-host tabs auto-navigate within ~2s via the 409-after-result signal.

---

## Phase 4: User Story 2 — Result Screen Renders Correct Word, Scores, and Guess History (Priority: P1)

**Goal**: When the game snapshot has `status === "result"`, every participant sees a dedicated
result screen showing the secret word, a neutral descending scoreboard, and the full chronological
guess history. No canvas is rendered. No winner label is shown.

**Independent Test**: After ending a round, verify both tabs show: (1) the secret word prominently,
(2) all participants' scores sorted highest-first with no winner badge, (3) every submitted guess
in order with a correct/incorrect indicator, and (4) no canvas element.

### Implementation for User Story 2 — Component

- [X] T016 [US2] Create `frontend/src/components/ResultScreen.tsx`: props are `secretWord: string`, `scores: Record<string, number>`, `participants: Participant[]`, `guesses: GuessEntry[]`, `isHost: boolean`, `isRestarting: boolean`, `onRestart: () => void`; render a section header, the secret word in a prominent banner, reuse `<Scoreboard>` for scores (sorted descending inside Scoreboard), reuse `<ResultPanel>` for guess history; render "Restart" button ONLY when `isHost === true` (non-host players do not see the button); no canvas element — see `data-model.md` §`ResultScreen.tsx`

### Implementation for User Story 2 — Page Integration

- [X] T017 [US2] Update `frontend/src/pages/GamePage.tsx` to conditionally render `<ResultScreen>` when `game?.status === "result"`: pass `secretWord={game.secretWord}`, `scores={game.scores}`, `participants={game.participants}`, `guesses={game.guesses}`, `isHost={isHost}`, `isRestarting={isRestarting}`, `onRestart={handleRestart}` — stub `handleRestart` as a no-op for now (wired fully in T025); the existing game layout renders unchanged when `game.status === "playing"` — see `data-model.md` §Conditional render

**Checkpoint**: US2 independently testable — after ending a round, both tabs show the correct
result screen layout. The restart button appears for the host (no-op) and is absent for non-host.

---

## Phase 5: User Story 3 — Host Restarts and All Players Return to Lobby (Priority: P1)

**Goal**: The host triggers "Restart" from the result screen. The room transitions to `"lobby"`,
`currentRound` is set to `null`, and all participants are preserved. The host navigates to the
lobby immediately. Non-host players navigate automatically via poll-detected 409.

**Independent Test**: From the result screen, click "Restart" (host tab). Confirm: (1) host
navigates to lobby instantly, (2) non-host tab navigates to lobby within ~2s with no action,
(3) both lobby screens show all original participants, (4) `GET /rooms/:code/game` returns
`409 "Game has not started yet"`, (5) starting a new game produces a fresh round.

### Implementation for User Story 3 — Backend Service

- [X] T018 [US3] Add `restartGame(code, participantId)` service function to `backend/src/services/roomStore.ts`: validate room exists (404), validate host (403), validate `status === "result"` (409 "Round has not ended"), set `status = "lobby"`, set `currentRound = null`, persist, return `{ room: cloneRoom(room) }` — participants array untouched — see `data-model.md` §`restartGame`
- [X] T019 [P] [US3] Add `restartSchema` to `backend/src/api/schemas.ts`: `{ participantId: string, required, trimmed, min 1 }` — see `data-model.md` §`schemas.ts`

### Implementation for User Story 3 — Backend Tests

- [X] T020 [P] [US3] Add unit tests for `restartGame()` in `backend/src/services/roomStore.test.ts`: happy path (result → lobby, `currentRound === null`, participants preserved), 404 unknown room, 403 non-host, 409 status is playing, 409 status is lobby
- [X] T021 [P] [US3] Add unit tests for `restartSchema` in `backend/src/api/schemas.test.ts`: accepts valid `participantId`, rejects missing, rejects empty string

### Implementation for User Story 3 — Backend Route

- [X] T022 [US3] Add `POST /:code/restart` route to `backend/src/api/rooms.ts`: parse params with `roomCodeParamsSchema`, parse body with `restartSchema`, call `restartGame()`, return `{ room: toRoomSnapshot(result.room) }` — see `contracts/result-api.md` §New Endpoint restart

**Backend build + test checkpoint after T022**: `npm run build` and `npm test` must both be green.

### Implementation for User Story 3 — Frontend API + State

- [X] T023 [US3] Add `restartGame(code, participantId)` API method to `frontend/src/services/api.ts`: `POST /rooms/:code/restart` returning `{ room: RoomSnapshot }` — see `data-model.md` §New API methods
- [X] T024 [US3] Add `restartGame(code, participantId)` method to `frontend/src/state/gameStore.ts`: calls `api.restartGame`, on success sets `{ game: null, roundEnded: true }` and returns the room; on error sets `error` and returns null — see `data-model.md` §`restartGame` method

### Implementation for User Story 3 — Frontend Page + Component

- [X] T025 [US3] Update `frontend/src/pages/GamePage.tsx`: add `isRestarting` state; implement `handleRestart` callback that calls `gameStore.restartGame()`, on success calls `roomStore.setRoomSnapshot(updatedRoom)`; replace the no-op stub from T017 with this real callback — `roundEnded` effect from T015 handles navigation automatically for both host and non-host
- [X] T026 [US3] Wire Restart button props in `frontend/src/components/ResultScreen.tsx`: connect `isRestarting` prop to the button's `disabled` attribute and update the button label to `"Restarting…"` when true; confirm button is conditionally rendered only when `isHost === true`

**Checkpoint**: All three user stories independently functional and testable. Full Scenario 4
acceptance criteria met — end round, result screen, restart, lobby return.

---

## Phase 6: Polish & Final Validation

**Purpose**: Build gates and manual acceptance testing against all 18 quickstart steps.

- [X] T027 Final backend build and full test run — `cd backend && npm run build && npm test` must exit 0
- [X] T028 [P] Final frontend build — `cd frontend && npm run build` must exit 0
- [ ] T029 Manual 18-step validation per `specs/004-result-restart-validation/quickstart.md` — all happy paths and all error guard checks must pass in two browser tabs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories; T004 and T005 can run in parallel (different packages)
- **Phase 3 (US1)**: Depends on Phase 2 — backend tasks (T006–T012) must complete before frontend tasks (T013–T015)
- **Phase 4 (US2)**: Depends on Phase 3 complete — T016 can start once T004/T005 are done; T017 depends on T016
- **Phase 5 (US3)**: Depends on Phase 3 + Phase 4 complete — backend (T018–T022) is independent of frontend (T023–T026); T025 depends on T017 (ResultScreen exists) and T024
- **Phase 6 (Polish)**: Depends on all prior phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 (types). No dependency on US2 or US3.
- **US2 (P1)**: Requires US1 backend complete (result snapshot must exist to render). T016 component can be built in parallel with US1 frontend.
- **US3 (P1)**: Requires US1 (result state must exist to restart from) and US2 (ResultScreen must exist to host the Restart button). Backend portion (T018–T022) is independent of US2.

### Within Each User Story

- Backend service → schema → route (sequential within story)
- Backend tests ([P] with schema, depends on service)
- Frontend api method → store method → page/component (sequential)
- Component creation ([P] with api/store when in a new file)

### Parallel Opportunities

| Parallel Pair | Tasks | Condition |
|---|---|---|
| Backend + frontend types | T004, T005 | Different packages, independent definitions |
| endRound schema + tests | T008, T009, T010 | After T007 |
| restartGame schema + tests | T019, T020, T021 | After T018 |
| ResultScreen creation + api client | T016, T013 | Different files |
| Backend US3 + frontend US3 api | T018–T022, T023 | Different packages |
| Final build + test (backend/frontend) | T027, T028 | Different packages |

---

## Parallel Example: User Story 1 (backend sprint)

```text
After T006 (toGameSnapshot updated):
  Parallel A: T007 endRound() service
  Parallel B: T008 endRoundSchema

After T007 + T008:
  Parallel A: T009 unit tests for endRound
  Parallel B: T010 unit tests for endRoundSchema
  Sequential: T011 → T012 (routes, same file)
```

## Parallel Example: User Story 3 (backend sprint)

```text
Start T018 restartGame() service
  Once T018 done:
    Parallel A: T019 restartSchema
    Parallel B: T020 tests for restartGame
  Once T019 done:
    Parallel: T021 tests for restartSchema
  Sequential: T022 POST /restart route (depends on T018 + T019)
```

---

## Implementation Strategy

### MVP First (US1 Only — End Round Detectable)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational types (T004, T005)
3. Complete Phase 3: US1 — backend + frontend (T006–T015)
4. **STOP and VALIDATE**: call `POST /rooms/:code/end`, confirm `GET /rooms/:code/game` returns `status: "result"`, confirm both tabs transition
5. Proceed to US2 (result screen) then US3 (restart)

### Incremental Delivery

1. Phase 1 + Phase 2 → types compile, builds green
2. Phase 3 → US1 working: end round detected, tabs redirect
3. Phase 4 → US2 working: result screen shows word/scores/history
4. Phase 5 → US3 working: restart returns to lobby, participants preserved
5. Phase 6 → builds green, 18-step validation passes

---

## Notes

- `[P]` tasks operate on different files — safe to implement simultaneously
- Each user story phase ends with a checkpoint — stop and validate before continuing
- Never modify task definitions during implementation — open a new session if scope changes
- Commit after each task or logical group, referencing the task ID (e.g., `T007: add endRound service`)
- Build gates in T027/T028 must pass before the PR is raised
- All Scenario 1/2/3 behavior is unchanged — any regression in existing tests is a blocking defect
