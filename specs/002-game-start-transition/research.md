# Research: Game Start Transition

**Feature**: 002-game-start-transition
**Date**: 2026-06-01

---

## Decision 1 — Secret Word Selection Algorithm

**Decision**: Use `Math.floor(Math.random() * STARTER_WORDS.length)` to pick one word index
from the fixed 5-word `STARTER_WORDS` array. The selected word is stored in `Round.secretWord`.

**Rationale**: FR-006 requires random selection from the starter list. The constitution's
"defined order" clause guards against custom words or dynamic lists, not against randomness
within the fixed list. `Math.random()` is sufficient and idiomatic for in-memory game state;
no seed or PRNG abstraction is needed at this scope.

**Alternatives considered**:
- Always pick `STARTER_WORDS[0]` — deterministic but makes every game identical; poor UX.
- Round-robin index tracked on `Room` — needed for Scenario 3 (round cycling) but overkill
  for Scenario 2 single-round play.

---

## Decision 2 — Where `Round` Lives in Memory

**Decision**: `Round` is stored as `room.currentRound: Round | null` on the in-memory `Room`
object. It is never written to any external store.

**Rationale**: Follows the in-memory-only constraint from the constitution. The `Room` object
in the `rooms` Map is the single source of truth; `currentRound` is set to a new `Round`
object by `startGame` and reset to `null` when room is destroyed.

**Alternatives considered**:
- Separate `rounds` Map — unnecessary indirection for a single-round scenario.

---

## Decision 3 — `GameSnapshot` Shape and Viewer Scoping

**Decision**: `toGameSnapshot(room, viewerParticipantId?)` builds the response in one pass:
if `viewerParticipantId === room.currentRound.drawerId` the snapshot includes `secretWord`;
otherwise the field is simply not added to the returned object (field absent, not `null` or
`undefined`).

**Rationale**: A single construction function with a conditional field is the simplest
implementation. No two separate classes/interfaces are needed at runtime — TypeScript
discriminated unions express the difference at the type level.

**Type approach**:
```ts
interface GameSnapshotBase { code, status, roundNumber, drawerId, participants }
type DrawerGameSnapshot = GameSnapshotBase & { secretWord: string };
type GuesserGameSnapshot = GameSnapshotBase;
type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot;
```

---

## Decision 4 — Frontend State for Game Phase

**Decision**: Introduce a new `gameStore.ts` in `frontend/src/state/` following the exact
same `useSyncExternalStore` + class pattern as `roomStore.ts`. It holds `GameSnapshot | null`
and `participantId` (copied from `roomStore` state at game start).

**Rationale**: `roomStore` owns lobby state (`RoomSnapshot`). Mixing game state into it would
widen its type, break Scenario 1 consumers, and require all lobby code to handle
`GameSnapshot` fields. A dedicated store keeps concerns isolated, matches the existing
pattern, and requires zero changes to `roomStore`.

**Alternatives considered**:
- Extend `RoomState` in `roomStore` with optional game fields — simpler initially but
  creates tight coupling; rejected because it modifies Scenario 1 store shape.
- React Context alone — loses the `useSyncExternalStore` optimization; rejected.

---

## Decision 5 — Lobby Auto-Redirect for Non-Host Players

**Decision**: Extend the existing `LobbyPage` `setInterval` poll callback: after each
`fetchRoom()` call, check if `response.status === "playing"` and call `navigate("/game")`
immediately. No separate effect is needed.

**Rationale**: The poll callback already catches errors non-fatally. Adding a single status
check inside the same callback is the minimal additive change — zero new effects, zero new
state.

**Alternatives considered**:
- Separate `useEffect` watching `room.status` — would work but adds another dependency array
  and risks double-navigation.

---

## Decision 6 — `POST /rooms/:code/start` Authorization Check

**Decision**: Validate `participantId` against `room.hostId` inside the route handler before
calling any service logic. Return `403` immediately if the check fails or if `participantId`
is absent.

**Rationale**: Per spec clarification Q3, this is a game-rule integrity check, not
authentication. Keeping the check in the route handler (not the service) keeps the service
pure and focused on state mutation.

---

## Decision 7 — `RoomStatus` Type Widening and Backward Compatibility

**Decision**: Change `RoomStatus` from the literal `"lobby"` to `"lobby" | "playing"`.
The `RoomSnapshot.status` field is already typed as `RoomStatus`, so this one change
propagates automatically. The frontend `api.ts` `RoomSnapshot.status` field is similarly
widened to `"lobby" | "playing"`.

**Rationale**: Additive change — existing `"lobby"` consumers still work; new code can
branch on `"playing"`. Consistent with FR-014 (no existing fields removed or renamed).

---

## Summary Table

| # | Decision | File(s) Impacted |
|---|----------|-----------------|
| 1 | `Math.random()` word selection | `roomStore.ts` (backend) |
| 2 | `currentRound` on `Room` | `game.ts`, `roomStore.ts` (backend) |
| 3 | `toGameSnapshot` with conditional `secretWord` | `game.ts`, `roomStore.ts` (backend) |
| 4 | New `gameStore.ts` frontend state | `frontend/src/state/gameStore.ts` (new) |
| 5 | Lobby poll callback redirect | `LobbyPage.tsx` |
| 6 | Host check in route handler | `rooms.ts` (backend) |
| 7 | `RoomStatus` widened | `game.ts`, `api.ts` (frontend) |
