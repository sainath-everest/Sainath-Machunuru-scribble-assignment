# Research: Room Setup & Lobby

**Feature**: `001-room-setup-lobby`
**Date**: 2026-06-01
**Branch**: `001-room-setup-lobby`

All research findings are derived from direct codebase analysis of the existing starter.
No external package research was required — the tech stack is fully specified by the
constitution and the starter's `package.json` files.

---

## Decision 1: Host Identity Storage

**Question**: Where should `hostId` live, and what value should it hold?

**Decision**: `hostId` is stored as a `string` field on the backend `Room` object.
Its value is the `participantId` (UUID) of the first participant — i.e., the one created
by `createRoom`. It is set once at room creation and never mutated. It is included in
every `RoomSnapshot` response so the client can determine host identity without additional
endpoints.

**Rationale**: The existing `Participant` model already assigns each player a UUID via
`randomUUID()`. Reusing this value for `hostId` avoids a second identity mechanism.
Storing it on `Room` (not derived on-the-fly from participant list order) makes the
contract stable even if participant ordering ever changes.

**Alternatives considered**:
- Storing host as the first participant in the array: rejected — fragile if order changes.
- Separate `isHost` field per participant: rejected — redundant data that must stay in sync.

---

## Decision 2: Input Validation Strategy

**Question**: Where should empty/whitespace player name and room code validation live —
backend only, frontend only, or both?

**Decision**: Validate on **both** layers with Zod on the backend as the authoritative
gate and lightweight client-side guards on the frontend before the network call.

- Backend (`schemas.ts`): `z.string().trim().min(1)` for `playerName` and room code in
  path params validation.
- Frontend (`CreateRoomPage`, `JoinRoomPage`): trim + guard before invoking `roomStore`;
  show inline error without a network round-trip.

**Rationale**: Backend validation is non-negotiable (Zod is already in use per the
constitution). Frontend pre-validation improves UX (no network round-trip for a blank
name) and matches Constitution Principle V (deterministic rejection of empty names).

**Alternatives considered**:
- Frontend-only validation: rejected — backend has no protection against direct API calls.
- Backend-only validation: acceptable but results in a worse UX (network error for blank
  inputs instead of instant inline feedback).

---

## Decision 3: Lobby Polling Implementation

**Question**: How should the 2-second lobby polling loop be implemented?

**Decision**: `setInterval` inside a `useEffect` in `LobbyPage`, cleared in the cleanup
function. The interval calls `roomStore.fetchRoom()` (the existing method) every 2000ms.
Errors during polling are caught, displayed as a non-fatal inline message, and the interval
continues unchanged.

```
useEffect(() => {
  const id = setInterval(() => { roomStore.fetchRoom().catch(handleError); }, 2000);
  return () => clearInterval(id);
}, [roomStore]);
```

**Rationale**:
- `setInterval` + `useEffect` cleanup is the idiomatic React pattern for polling.
- Reuses the existing `fetchRoom` method — no new endpoint needed.
- Cleanup on unmount prevents memory leaks and stale-state updates (Constitution
  Principle I — no runtime errors from untyped/leaked async operations).
- Constant 2-second interval with error-tolerant continuation satisfies FR-007 and
  FR-015 exactly as clarified (Q3: same interval after failure).

**Alternatives considered**:
- Recursive `setTimeout`: equivalent, slightly more complex; rejected for simplicity.
- React Query / SWR polling: introduces a new library dependency; rejected by constitution
  (no unjustified top-level dependencies).
- Polling inside `RoomStore` class: possible, but couples the store to timing concerns;
  rejected to keep the store focused on state management.

---

## Decision 4: Start Game Gating Logic

**Question**: How should the "host-only, 2-player minimum" Start Game gate be implemented?

**Decision**: Derive two booleans in `LobbyPage` from the current room state:

```
const isHost = room.hostId === participantId;
const canStart = isHost && room.participants.length >= 2;
```

- Non-hosts: button is hidden (`isHost === false` → render nothing or render disabled).
- Host with < 2 participants: button is rendered but `disabled`; a helper message is shown.
- Host with ≥ 2 participants: button is enabled; clicking navigates host to `/game`.

**Rationale**: Both values are derived from data already in `RoomStore` state on every
poll tick. No extra API call or server-side action is needed for Scenario 1 scope.
The gate re-evaluates on every render triggered by a poll update, so it stays in sync.

**Alternatives considered**:
- Server-side enforcement of the start precondition: not in Scenario 1 scope; the Start
  Game action is UI-level gating only. No server-side game-state transition occurs.
- Counting participants server-side and returning a `canStart` boolean: over-engineering
  for Scenario 1; participant count is already in the snapshot.

---

## Summary of NEEDS CLARIFICATION Items

All NEEDS CLARIFICATION items from the spec were resolved in the clarification session
(2026-06-01). No open unknowns remain before Phase 1 design.

| Item | Resolution |
|------|-----------|
| Non-host transition on game start | Out of Scenario 1 scope; only the host navigates to /game |
| `hostId` in RoomSnapshot | Included in every snapshot response |
| Polling interval after error | Same ~2s interval, unchanged |
