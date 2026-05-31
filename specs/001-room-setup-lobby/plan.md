# Implementation Plan: Room Setup & Lobby

**Branch**: `001-room-setup-lobby` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-room-setup-lobby/spec.md`

## Summary

Extend the Scribble starter to fully implement Scenario 1: room creation with host
tracking, room joining with input validation, automatic lobby polling (~2s), host-only
Start Game gated on a 2-player minimum, and full room isolation. All changes are brownfield
additions to the existing Express backend and React frontend — no new libraries, no new
routing patterns, no persistence layer.

The primary technical approach is:
- Extend `Room` and `RoomSnapshot` with a `hostId` field (backend model + API response).
- Add Zod-level trim-and-reject validation for empty/whitespace player names and room codes.
- Replace the manual Refresh button in `LobbyPage` with a `setInterval`-based polling loop
  inside a `useEffect`, stopped on unmount.
- Drive "Host" label and Start Game enablement from `hostId` vs local `participantId`.

## Technical Context

**Language/Version**: TypeScript 5.6 (backend + frontend); Node.js 18+

**Primary Dependencies**:
- Backend: Express 4.21, Zod 3.23, tsx 4.19, `node:crypto` (built-in)
- Frontend: React 18.3, React Router 6.30, Vite 5.4, Vitest 3.1

**Storage**: In-memory JavaScript `Map<string, Room>` on the backend. No persistence.

**Testing**: Vitest (backend unit tests in `backend/src/**/*.test.ts`;
frontend unit tests in `frontend/src/**/*.test.ts`)

**Target Platform**: Modern desktop browser (Chrome/Firefox/Safari); backend Node.js 18+

**Project Type**: Web application — monorepo with separate `backend/` and `frontend/`

**Performance Goals**: Lobby polling visible within 3 seconds of a join event;
API response times expected well under 100ms for in-memory operations.

**Constraints**: HTTP polling only (no WebSockets); in-memory only (no DB); no auth;
no new top-level npm dependencies beyond what the starter already ships.

**Scale/Scope**: 2–10 players per room; handful of concurrent rooms; single server instance.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript First | ✅ Pass | All new/modified files are `.ts`/`.tsx`; strict typing throughout; no `any` introduced |
| II. HTTP Polling Only | ✅ Pass | Lobby uses `setInterval` polling against existing REST endpoint; no push protocol |
| III. In-Memory Storage Only | ✅ Pass | `hostId` added to in-memory `Room` object; no persistence layer touched |
| IV. Spec-Driven Development | ✅ Pass | `spec.md` → clarify → this `plan.md`; tasks not yet started |
| V. Deterministic Game Rules | ✅ Pass | Scenario 1 has no game-rule logic; name validation is deterministic |
| VI. AI Review Discipline | ✅ Pass | Plan reviewed before implementation begins |

**No violations. No Complexity Tracking entries required.**

**Post-design re-check**: All principles still pass after Phase 1 design (see data-model.md
and contracts/). `hostId` is a plain string field on an existing interface; no architectural
changes introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-room-setup-lobby/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── rooms-api.md     # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   └── game.ts          ← ADD hostId to Room + RoomSnapshot; RoomStatus unchanged
│   ├── services/
│   │   └── roomStore.ts     ← SET hostId on createRoom; include in toRoomSnapshot
│   └── api/
│       ├── schemas.ts       ← ADD trim+reject validation to createRoomSchema + joinRoomSchema
│       └── rooms.ts         ← no structural change; validation upgrade flows from schemas
└── src/
    ├── api/schemas.test.ts  ← ADD tests for whitespace rejection
    └── services/roomStore.test.ts ← ADD test for hostId on createRoom

frontend/
└── src/
    ├── services/
    │   └── api.ts           ← ADD hostId to RoomSnapshot interface
    ├── state/
    │   └── roomStore.ts     ← no structural change needed
    ├── pages/
    │   ├── CreateRoomPage.tsx  ← ADD client-side name validation before submit
    │   ├── JoinRoomPage.tsx    ← ADD client-side name + code validation before submit
    │   └── LobbyPage.tsx       ← REPLACE manual refresh with setInterval polling;
    │                              ADD host badge; ADD host-only + 2-player Start Game gate
    └── services/
        └── api.test.ts      ← ADD test for joinRoom sending correct payload
```

**Structure Decision**: Option 2 (web application) — existing `backend/` + `frontend/`
monorepo. All changes are brownfield additions to existing files; no new files except
tests and spec artifacts.

## Implementation Sequence

The order below respects data-flow dependencies — backend model changes first, then API
contract, then frontend type updates, then UI behaviour.

1. **Backend model** (`game.ts`): add `hostId: string` to `Room` and `RoomSnapshot`.
2. **Backend service** (`roomStore.ts`): set `hostId = participant.id` in `createRoom`;
   include `hostId` in `toRoomSnapshot`; `viewerParticipantId` remains unused in Scenario 1.
3. **Backend validation** (`schemas.ts`): tighten `playerName` and room code to
   `z.string().trim().min(1, "Player name is required")` / `"Room code is required"`.
4. **Frontend types** (`api.ts`): add `hostId: string` to `RoomSnapshot`.
5. **Frontend validation** (`CreateRoomPage`, `JoinRoomPage`): trim + guard before
   calling store; surface inline errors without hitting the network.
6. **Lobby polling** (`LobbyPage`): replace manual button logic with `useEffect`
   `setInterval` at 2000ms; clear on unmount; display non-fatal error on poll failure
   without stopping the interval.
7. **Lobby host UI** (`LobbyPage`): derive `isHost = room.hostId === participantId`;
   show "Host" badge next to creator; disable/hide Start Game for non-hosts;
   disable Start Game for host when `room.participants.length < 2`.

## Testing Strategy

- Unit: Vitest tests for Zod schema whitespace rejection (backend) and `createRoom`
  returning correct `hostId` (backend service).
- Manual integration: Two-tab verification per acceptance scenario (documented in
  `quickstart.md`).
- No new test framework required; existing `vitest run` scripts cover both packages.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| `participantId` lost on tab refresh → polling uses stale/missing ID | Low (known assumption) | Documented in spec Assumptions; out of scope |
| Polling fires after component unmounts (memory leak / React warning) | Medium | `clearInterval` in `useEffect` cleanup is mandatory |
| Start Game button state stale between polls | Low | Button state is derived from `room.participants.length` which is updated on every poll tick |
