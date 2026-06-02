# Research: Result, Restart & Final Validation

**Feature**: `004-result-restart-validation` | **Date**: 2026-06-02

All decisions derived from reading the existing codebase (`backend/src/`, `frontend/src/`) plus
the Scenario 4 spec and clarifications. No external unknowns remain.

---

## Decision 1: `"result"` as a third `RoomStatus` value

**Decision**: Add `"result"` to the `RoomStatus` union in `backend/src/models/game.ts` and
mirror it in `frontend/src/services/api.ts`. No new status tracking field is needed anywhere.

**Rationale**: The room already has a `status` field (`"lobby" | "playing"`) used for lifecycle
gating by every service function. Adding `"result"` follows the same pattern with zero new
infrastructure. All existing guards (`status !== "playing"`) naturally block Scenario 3
operations while the room is in `"result"` status — no changes needed to those guards.

**Alternatives considered**:
- Separate `roundState` field — rejected; adds a second lifecycle axis with no benefit.
- Boolean `roundEnded` flag — rejected; status is already the canonical lifecycle indicator.

---

## Decision 2: Preserve `currentRound` during result state

**Decision**: `currentRound` is NOT nulled when the round ends. It remains set with the
completed round's data (`secretWord`, `drawerId`, `strokes`, `guesses`, `scores`) while
`room.status === "result"`. `currentRound` is set to `null` only on restart.

**Rationale**: The result screen must render `secretWord`, `scores`, `guesses`. Those values
live in `currentRound`. Preserving it avoids copying round data elsewhere and keeps
`toGameSnapshot` the single source of truth for what each participant sees.

**Alternatives considered**:
- Copy round data into a `lastRound` snapshot field — rejected; duplicates data already in
  `currentRound` and requires a new `Room` field and additional serialization logic.

---

## Decision 3: `toGameSnapshot` handles both `"playing"` and `"result"` status

**Decision**: `toGameSnapshot` checks `room.status`. When `"playing"`, existing behavior is
preserved (drawer gets `secretWord`, guesser does not). When `"result"`, `secretWord` is
included for ALL participants in the base snapshot — no `viewerParticipantId` branching.
The returned snapshot sets `status: "result"`.

**Rationale**: A single function already owns the serialization logic. Extending it with a
`room.status === "result"` branch is the lowest-diff approach. It also means `GET /rooms/:code/game`
needs only a one-line status-guard change (accept `"result"` in addition to `"playing"`).

**Alternatives considered**:
- Separate `toResultSnapshot` function — rejected; duplicates all base-field mapping.
- New `GET /rooms/:code/result` endpoint — rejected; requires a new route and frontend poll,
  violating the "no new polling endpoints" constraint from Scenario 3.

---

## Decision 4: `GET /rooms/:code/game` serves the result state

**Decision**: The existing `GET /rooms/:code/game` route currently returns `409` when
`room.status !== "playing"`. Change the guard to also pass when `room.status === "result"`,
calling `toGameSnapshot(room, participantId)` for both cases.

**Rationale**: Non-host players are already polling this endpoint. Serving the result snapshot
on the same endpoint means no polling reconfiguration is needed. After restart (`currentRound`
is null, `status` is `"lobby"`), the same 409 guard fires again — giving the frontend a
consistent signal (409 = no active round = go to lobby).

**Alternatives considered**:
- Change guard to check `currentRound === null` instead of `status` — rejected; `"result"`
  preserves `currentRound` by design (Decision 2), so this check would be incorrect.

---

## Decision 5: Frontend restart-detection via 409 after result state

**Decision**: Add a `roundEnded: boolean` field to `GameState`. `GameStore.fetchGame`
sets `roundEnded: true` when it receives a 409 error AND `this.state.game?.status === "result"`
(meaning: the poll received a no-active-round error after the result was being displayed →
restart has occurred). `GamePage` watches `roundEnded` and navigates to `/lobby` when it
flips to `true`. `GameStore.restartGame` also sets `roundEnded: true` immediately for the
host (who triggers the restart action directly).

**Rationale**: Using the 409 signal as a redirect trigger is consistent with how `GamePage`
already uses the `!room` guard to redirect to `/`. Scoping it to `game.status === "result"`
prevents false positives during initial load (when the game simply hasn't started yet).

**Alternatives considered**:
- Poll `GET /rooms/:code` in parallel during result state — rejected; introduces a second
  concurrent polling loop and complicates teardown.
- Manual "Return to Lobby" button for non-host — rejected; spec (FR-018a) requires automatic
  navigation.

---

## Decision 6: `endRound` and `restartGame` service functions

**Decision**: Add two new service functions to `roomStore.ts`:
- `endRound(code, participantId)` → validates host, validates `"playing"` status, sets
  `room.status = "result"`, persists, returns `{ room: cloneRoom(room) }`.
- `restartGame(code, participantId)` → validates host, validates `"result"` status, sets
  `room.status = "lobby"`, sets `room.currentRound = null`, persists, returns
  `{ room: cloneRoom(room) }`. Participants are untouched.

Both functions throw `HttpError` for authorization and state-guard failures, following the
exact same pattern as `startGame`, `addStroke`, `submitGuess`.

**Rationale**: All business logic lives in `roomStore.ts`. Routes remain thin (parse → call
service → serialize). This is the established pattern for all Scenario 2/3 operations.

**Alternatives considered**:
- Inline logic in route handlers — rejected; violates the service-layer separation used
  throughout the codebase.

---

## Decision 7: Zod schemas for new endpoints

**Decision**: Add `endRoundSchema` and `restartSchema` to `schemas.ts`. Both are identical
in shape to `startRoomSchema` — a single `participantId` string field. Reuse is not applied
(keep them named separately for readability and independent evolution).

**Rationale**: All request payloads in this codebase are validated with Zod. The schema for
host-only actions (`start`, `end`, `restart`) is identical: `{ participantId: string }`.

---

## Decision 8: `ResultScreen` as a new frontend component

**Decision**: Create `frontend/src/components/ResultScreen.tsx`. It accepts props:
`secretWord`, `scores`, `participants`, `guesses`, `isHost`, `onRestart` (async callback),
and `isRestarting` (boolean). `GamePage` renders `<ResultScreen>` when
`game?.status === "result"`, otherwise renders the existing game layout unchanged.

**Rationale**: Inlining the result UI in `GamePage` would make the component significantly
harder to read and test. A dedicated component keeps responsibilities clear and matches the
Scenario 3 pattern (each UI slice has its own component file).

**Alternatives considered**:
- Reuse/extend `ResultPanel` — rejected; `ResultPanel` renders guess history only. The result
  screen is a top-level layout with three distinct sections (word, scoreboard, history).
