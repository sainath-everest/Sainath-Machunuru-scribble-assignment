---
description: "Task list for Room Setup & Lobby (Scenario 1)"
---

# Tasks: Room Setup & Lobby

**Input**: Design documents from `specs/001-room-setup-lobby/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/rooms-api.md ✅ | research.md ✅

**Tests**: Unit test tasks are included where they directly verify acceptance criteria.
Manual integration validation is covered by `quickstart.md`.

**Organization**: Tasks are grouped by user story (US1–US5 from `spec.md`) and ordered
so each phase can be validated independently before the next one begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel — it touches a different file from all other current in-flight tasks
- **[Story]**: User story this task belongs to (US1–US5)
- Exact file paths are included in every task description

## Path Conventions

- Backend source: `backend/src/`
- Frontend source: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Verify the starter is green before any changes are made.

- [X] T001 [P] Verify backend builds: run `cd backend && npm run build` — resolve any pre-existing TypeScript errors
- [X] T002 [P] Verify frontend builds: run `cd frontend && npm run build` — resolve any pre-existing TypeScript errors
- [X] T003 Verify test suites pass: run `npm test` in `backend/` then `npm test` in `frontend/`

**Checkpoint**: All builds green, all existing tests pass — ready to begin changes.

---

## Phase 2: Foundational — Data Model (Strictly Sequential)

**Purpose**: Extend the backend and frontend data model with `hostId`. These four tasks
MUST run in order — each depends on the previous one.

- [X] T004 Add `hostId: string` to both the `Room` and `RoomSnapshot` interfaces in `backend/src/models/game.ts`
- [X] T005 In `backend/src/services/roomStore.ts`, update `createRoom` to set `hostId: participant.id` on the new room object
- [X] T006 In `backend/src/services/roomStore.ts`, update `toRoomSnapshot` to include `hostId: room.hostId` in the returned snapshot
- [X] T007 Add `hostId: string` to the `RoomSnapshot` interface in `frontend/src/services/api.ts` to mirror the backend model

**Checkpoint**: Run `npm run build` in both `backend/` and `frontend/` — zero TypeScript errors
required before starting any user story phase.

---

## Phase 3: US1 — Host Creates a Room (Priority: P1) 🎯 MVP

**Goal**: A player creates a room, lands in the lobby as the identified host, and sees a
"Host" badge next to their name. Empty or whitespace-only player names are rejected.

**Independent Test**: Single tab — enter a name, create a room, confirm the lobby shows
the room code and a "Host" badge. Submit the form with a blank name and confirm an inline
error appears with no navigation.

- [X] T008 [US1] Tighten `createRoomSchema` in `backend/src/api/schemas.ts`: replace `z.string().optional()` with `z.string().trim().min(1, "Player name is required")`
- [X] T009 [P] [US1] Add client-side player name validation in `frontend/src/pages/CreateRoomPage.tsx`: trim the input value, show an inline error and abort the submit if it is blank — do not call `roomStore.createRoom`
- [X] T010 [P] [US1] Derive `isHost = room.hostId === participantId` in `frontend/src/pages/LobbyPage.tsx` and render a visible "Host" label next to the creator's entry in the participant list
- [X] T011 [P] [US1] Add unit test in `backend/src/services/roomStore.test.ts`: verify `createRoom` sets `hostId` equal to the returned `participantId`
- [X] T012 [P] [US1] Add unit test in `backend/src/api/schemas.test.ts`: verify `createRoomSchema` throws on empty string and on a whitespace-only string

> T009, T010, T011, T012 can all run in parallel after T008 — each touches a different file.

**Checkpoint**: US1 independently verifiable — one-tab create + lobby host badge + blank-name error works.

---

## Phase 4: US2 — Second Player Joins a Room (Priority: P1)

**Goal**: A second player joins by entering a room code and lands in the lobby. Empty
name, empty code, and an invalid code each produce a distinct inline error.

**Independent Test**: Two tabs — Tab A creates a room, Tab B joins with the correct code.
Confirm both see the participant list. Test all three error cases in Tab B.

- [X] T013 [US2] Tighten `joinRoomSchema` in `backend/src/api/schemas.ts`: replace `z.string().optional()` with `z.string().trim().min(1, "Player name is required")`
- [X] T014 [P] [US2] Add client-side name and room code validation in `frontend/src/pages/JoinRoomPage.tsx`: trim both inputs, show inline errors and abort submit if either is blank — do not call `roomStore.joinRoom`
- [X] T015 [P] [US2] Add unit test in `backend/src/api/schemas.test.ts`: verify `joinRoomSchema` throws on empty string and on a whitespace-only string for `playerName`

> T014 and T015 can both run in parallel after T013 — different files.

**Checkpoint**: US2 independently verifiable — two-tab join works; all three error cases show inline messages.

---

## Phase 5: US5 — Room Isolation (Priority: P1)

**Goal**: Two active rooms maintain independent participant lists with no cross-contamination.

**Independent Test**: Create two rooms, join each with a different player. Confirm neither
room's participant list shows the other room's player.

**Note**: Isolation is inherent in the backend `Map<string, Room>`. No implementation
code is needed — this phase is a unit test only.

- [X] T016 [P] [US5] Add unit test in `backend/src/services/roomStore.test.ts`: create two rooms, join a player to room 2 only, assert room 1's participant list still contains only the original player

**Checkpoint**: US5 covered by unit test. Manual two-tab check per `quickstart.md` Step 6.

---

## Phase 6: US3 — Lobby Auto-Polling (Priority: P2)

**Goal**: All lobby participants see new joiners appear within ~3 seconds without any
manual action. A polling failure shows a non-fatal inline error without stopping the poll
or navigating away.

**Independent Test**: Tab A in lobby, Tab B joins — Tab B's name appears in Tab A within
3 seconds. Stop the backend; confirm Tab A shows an error but stays on the lobby screen
and resumes normal display when the backend restarts.

- [X] T017 [US3] Update `frontend/src/pages/LobbyPage.tsx`: replace the manual Refresh button handler with a `useEffect` that starts a `setInterval` calling `roomStore.fetchRoom()` every 2000 ms; return `clearInterval` as the cleanup to stop polling on unmount; catch poll errors and display a non-fatal inline message without redirecting or altering the interval

> T017 is a single cohesive change to the polling lifecycle and error path in `LobbyPage.tsx`.

**Checkpoint**: US3 complete — auto-refresh and error resilience verified per `quickstart.md` Steps 4 and 8.

---

## Phase 7: US4 — Host-Only Start Game with 2-Player Minimum (Priority: P2)

**Goal**: The Start Game button is hidden or disabled for non-hosts at all times. The host
sees it disabled until 2+ participants are present, then enabled. Clicking it navigates
the host to `/game`.

**Independent Test**: Single-player lobby → Start Game disabled for host. Second player
joins → host's button enables; non-host's button stays hidden/disabled. Host clicks →
navigates to `/game`; non-host tab stays on `/lobby`.

**Dependency**: T018 must run after T010. It uses the `isHost` boolean already derived in
`LobbyPage.tsx` by T010.

- [X] T018 [US4] Update `frontend/src/pages/LobbyPage.tsx`: derive `canStart = isHost && room.participants.length >= 2`; hide or permanently disable the Start Game button when `!isHost`; disable it with a "Need at least 2 players" message when `isHost && !canStart`; enable it and navigate to `/game` on click when `canStart`

> T018 is a single cohesive change to the Start Game button in `LobbyPage.tsx`.

**Checkpoint**: US4 complete — host gating and 2-player minimum verified per `quickstart.md` Step 5.

---

## Phase 8: Polish & Validation

**Purpose**: Confirm the full implementation compiles cleanly, all tests pass, and every
acceptance criterion is met end-to-end.

- [X] T019 [P] Run `cd backend && npm run build` — zero TypeScript errors
- [X] T020 [P] Run `cd frontend && npm run build` — zero TypeScript errors
- [X] T021 [P] Run `npm test` in `backend/` — all unit tests pass (T011, T012, T015, T016 + existing)
- [X] T022 [P] Run `npm test` in `frontend/` — all unit tests pass (no frontend tests file present)
- [ ] T023 Complete manual two-tab validation following `specs/001-room-setup-lobby/quickstart.md` Steps 1–10

> T019–T022 are all independent and can run in parallel.

---

## Execution Order Summary

```
Phase 1  →  Phase 2 (T004 → T005 → T006 → T007, strictly sequential)
                 ↓
         ┌───────┼───────┐
      Phase 3  Phase 4  Phase 5
      (US1)    (US2)    (US5)
         └───────┼───────┘
                 ↓
             Phase 6 (US3)
                 ↓
             Phase 7 (US4)  ← requires T010 from Phase 3
                 ↓
             Phase 8 (Polish)
```

**LobbyPage.tsx edit sequence** (all sequential, same file):
```
T010 (Phase 3) → T017 (Phase 6) → T018 (Phase 7)
```

**Key inter-phase dependency**: T018 (US4) reads `isHost` set by T010 (US1). Complete
Phase 3 before starting Phase 7.

---

## Implementation Strategy

### MVP First (Phases 1–5: all three P1 stories)

1. Phase 1: Verify starter baseline
2. Phase 2: Add `hostId` to model — CRITICAL, blocks everything
3. Phase 3: US1 — create room, host badge, name validation
4. Phase 4: US2 — join room, code + name validation
5. Phase 5: US5 — isolation unit test
6. **STOP and VALIDATE** — two-tab create + join end-to-end; manual Steps 1–3, 6–7

### Full Scenario 1 Delivery

7. Phase 6: US3 — auto-polling
8. Phase 7: US4 — host-only start gate
9. Phase 8: Polish — builds green, tests pass, full `quickstart.md`

---

## Notes

- `[P]` means a different file is touched with no pending dependencies — safe to parallelize within a phase
- Tasks without `[P]` in the same phase MUST run sequentially
- Commit after each phase or logical group; reference the task ID (e.g. `feat: T008 tighten createRoomSchema`)
- Never start Phase 7 (US4) without completing T010 in Phase 3 — T018 depends on the `isHost` boolean
