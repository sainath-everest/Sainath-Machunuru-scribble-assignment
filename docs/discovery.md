# Discovery Notes — Scribble Starter

**Date**: 2026-06-01
**Branch**: main (scaffold)
**Explored by**: Sainath Machunuru

---

## 1. Existing Working Functionality

The following behaviors were verified by reading the source code and manual browser testing.

| Area | What Works |
|------|-----------|
| App shell & routing | React Router v6 with five routes: `/`, `/create-room`, `/join-room`, `/lobby`, `/game`. Unknown routes redirect to `/`. |
| Start page | Renders "Create Room" and "Join Room" links correctly. |
| Create Room flow | `CreateRoomPage` submits player name → calls `POST /rooms` → stores session in `RoomStore` → navigates to `/lobby`. |
| Join Room flow | `JoinRoomPage` submits player name + room code → calls `POST /rooms/:code/join` → stores session → navigates to `/lobby`. |
| Lobby page | Displays participant list from `RoomStore` state, shows room code badge, and has a **manual** Refresh button that calls `GET /rooms/:code`. |
| Game page scaffold | Page renders with layout zones for canvas, guess form, scoreboard, result panel, and player info card. Guards redirect to `/` if room state is missing. |
| Backend health | `GET /health` returns `{ ok: true }`. |
| Backend rooms API | `POST /rooms`, `POST /rooms/:code/join`, and `GET /rooms/:code` all respond correctly with room snapshots. |
| In-memory room store | Rooms are keyed by a unique 4-character alphanumeric code. `structuredClone` is used for isolation; no accidental shared references. |
| Frontend state management | `RoomStore` uses `useSyncExternalStore` with a hand-rolled observer. Loading and error states are tracked per-operation. |
| Backend validation | Zod schemas validate all request payloads; `ZodError` is caught by the centralized error handler and returns HTTP 400. |
| Starter seed data | Five fixed words (`rocket`, `pizza`, `castle`, `guitar`, `sunflower`) and two roles (`drawer`, `guesser`) are defined in `backend/src/seed/starterData.ts`. |

---

## 2. Incomplete or Missing Behaviors

### Gap 1 — No automatic lobby polling

**File**: `frontend/src/pages/LobbyPage.tsx`

The lobby refresh is entirely manual. Clicking "Refresh Room" triggers a single `fetchRoom()` call. There is no `setInterval` or `useEffect`-based polling loop. The business requirement specifies that the lobby MUST poll approximately every 2 seconds so new joiners appear without manual intervention. Until polling is implemented, a second player joining the room will not appear in the host's participant list unless the host clicks the button.

### Gap 2 — No host identity or host-only permissions

**Files**: `backend/src/models/game.ts`, `frontend/src/pages/LobbyPage.tsx`

The `Room` model has no `hostId` field. The participant who created the room is the first entry in `room.participants`, but there is no persistent marker distinguishing them as host. As a result:
- The lobby's "Start Game" button is rendered and clickable for every participant, not just the host.
- There is no 2-player minimum check before starting.
- Host-only UI differentiation (e.g., a "Host" badge) cannot be displayed.

### Gap 3 — Game state model is missing entirely

**File**: `backend/src/models/game.ts`

`RoomStatus` is typed as `"lobby"` only. The `Room` interface carries no fields for:
- `currentWord` (secret word for the active round)
- `drawerId` / `drawerParticipantId` (which player is drawing)
- `guesses` (submitted guess history)
- `scores` (per-participant score map)
- `roundStatus` (e.g., `"playing"` | `"result"`)

Without these fields, Scenarios 2–4 (game start, gameplay interaction, result, and restart) cannot be built on top of the existing data model.

### Gap 4 — Guess submission is a no-op

**File**: `frontend/src/components/GuessForm.tsx`

`handleSubmit` calls `event.preventDefault()` and nothing else. There is no API call, no `RoomStore` action, and no validation. The "Submit Guess" button renders but produces no observable effect.

### Gap 5 — No drawing canvas

**File**: `frontend/src/pages/GamePage.tsx`

The canvas area is a static `<div>` placeholder with the text "Waiting for drawer…". There is no `<canvas>` element, no pointer event listeners, no stroke serialization, and no mechanism to share drawing state with other participants.

### Gap 6 — Scoreboard and ResultPanel are hardcoded

**Files**: `frontend/src/components/Scoreboard.tsx`, `frontend/src/components/ResultPanel.tsx`

Both components render static placeholder markup unconnected to any real state. `Scoreboard` always shows "0"; `ResultPanel` always shows "Game activity and guesses will appear here."

### Gap 7 — No game start, result, or restart backend endpoints

**File**: `backend/src/api/rooms.ts`

The rooms router exposes three routes: `POST /rooms`, `POST /rooms/:code/join`, and `GET /rooms/:code`. There are no endpoints for:
- `POST /rooms/:code/start` — transition room to "playing"
- `POST /rooms/:code/guess` — submit and evaluate a guess
- `POST /rooms/:code/restart` — reset round state and return to lobby

### Gap 8 — Player name validation is absent

**Files**: `backend/src/api/schemas.ts`, `backend/src/services/roomStore.ts`

`createRoomSchema` and `joinRoomSchema` declare `playerName` as `z.string().optional()`. An empty or whitespace-only name is silently coerced to `"Player"` by the `displayName()` helper. No HTTP error is returned, and no user-facing validation message is shown in the frontend forms.

---

## 3. Assumptions Requiring Clarification

### Assumption A — Participant identity across page navigation

`participantId` is stored exclusively in `RoomStore`, which is a React Context object initialized fresh on every page load. If a player refreshes the browser tab, their `participantId` is lost. Subsequent calls to `GET /rooms/:code?participantId=...` will use an undefined participant ID, and the player will have no way to re-identify themselves without rejoining.

**Clarification needed**: Is tab-refresh survival in scope? If so, should `participantId` and `roomCode` be persisted to `sessionStorage`? The README does not address this.

### Assumption B — Word selection algorithm for determinism

The README specifies that secret word selection MUST be "deterministically selected from the starter list," but the algorithm is unspecified. Options include:
- Always select the first word (`"rocket"`)
- Select based on the number of rounds played modulo the word list length
- Select based on a hash of the room code

**Clarification needed**: What is the selection rule? Without agreement on this, the spec's acceptance criteria for Scenario 2 cannot be verified mechanically.

### Assumption C — Single-round scope

The `GamePage` header hardcodes "Round 1" and the README's out-of-scope list explicitly excludes "multiple rounds" and "drawer rotation." However, it is unclear whether the result/restart flow (Scenario 4) is intended to support one round only or is expected to be extensible to multiple rounds in a future iteration.

**Clarification needed**: Does the restart flow loop back to the same drawer and same word, or does it clear drawer assignment and word selection as if starting fresh?

---

## 4. Relevant Files

### Backend

| File | Purpose |
|------|---------|
| `backend/src/models/game.ts` | Core data types: `Room`, `Participant`, `RoomSnapshot`, `RoomStatus` |
| `backend/src/services/roomStore.ts` | In-memory room CRUD: `createRoom`, `joinRoom`, `getRoom`, `saveRoom`, `toRoomSnapshot` |
| `backend/src/api/rooms.ts` | Express route handlers for the three existing room endpoints |
| `backend/src/api/router.ts` | API router assembly; centralized error and 404 handlers |
| `backend/src/api/schemas.ts` | Zod validation schemas and `HttpError` class |
| `backend/src/app.ts` | Express app factory; CORS, JSON parsing, router mounting |
| `backend/src/seed/starterData.ts` | Fixed word list and role list |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/services/api.ts` | Typed fetch wrapper; `api.createRoom`, `api.joinRoom`, `api.fetchRoom` |
| `frontend/src/state/roomStore.ts` | `RoomStore` class + React Context + `useRoomState` / `useRoomStore` hooks |
| `frontend/src/pages/LobbyPage.tsx` | Lobby UI; participant list; manual refresh button; "Start Game" navigation |
| `frontend/src/pages/GamePage.tsx` | Game page layout; canvas placeholder; integrates `GuessForm`, `Scoreboard`, `ResultPanel` |
| `frontend/src/components/GuessForm.tsx` | Guess input form (no-op submit handler — needs implementation) |
| `frontend/src/components/Scoreboard.tsx` | Static placeholder (needs real data binding) |
| `frontend/src/components/ResultPanel.tsx` | Static placeholder (needs real data binding) |
| `frontend/src/routes/index.tsx` | React Router route table |
| `frontend/src/components/AppShell.tsx` | Page chrome: header and main content wrapper |

---

## 5. Bugs and Inconsistencies Found

### Bug 1 — Incorrect API base URL (FIXED)

**File**: `frontend/src/services/api.ts`
**Commit fix**: `692dd23` — "Fix api base path"

During initial exploration, **room creation and lobby navigation were not working**. Every API call (`POST /rooms`, `POST /rooms/:code/join`, `GET /rooms/:code`) returned a 404. Tracing the failure to the network layer revealed that `API_BASE_URL` was set to:

```ts
// Before fix — caused all API calls to fail with 404
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/bug";
```

The hardcoded `/bug` suffix caused all requests to target paths like `http://localhost:3001/bug/rooms` instead of `http://localhost:3001/rooms`. The backend has no `/bug` prefix mount; those routes do not exist.

**Fix applied**: The fallback was corrected to `"http://localhost:3001"`:

```ts
// After fix — matches backend mount point
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
```

After this fix, room creation, room joining, and lobby navigation all worked as expected.

---

### Bug 2 — `toRoomSnapshot` ignores `viewerParticipantId`

**File**: `backend/src/services/roomStore.ts`, line 100

```ts
export function toRoomSnapshot(room: Room, viewerParticipantId?: string): RoomSnapshot {
  void viewerParticipantId;   // parameter is discarded
  ...
}
```

The parameter is accepted but immediately voided. Viewer-aware logic (e.g., revealing the secret word only to the drawer) depends on this parameter. It must be used, not discarded, once game state is added to the model.

---

### Bug 3 — `RoomStatus` type blocks future game states

**File**: `backend/src/models/game.ts`, line 2

```ts
export type RoomStatus = "lobby";
```

This union type only permits `"lobby"`. Any attempt to set `room.status = "playing"` will produce a TypeScript compile error. The type needs to be widened to include at least `"playing"` and `"result"` before Scenarios 2–4 can be implemented.

---

### Bug 4 — `useEffect` no-op in `RoomStoreProvider`

**File**: `frontend/src/state/roomStore.ts`, line 112

```ts
useEffect(() => undefined, []);
```

This effect returns `undefined` (not a cleanup function) and has no side effects. It is a no-op. While it does not cause a runtime error, it is misleading and should either be removed or replaced with actual initialization logic (e.g., reading persisted session from `sessionStorage`).

---

### Inconsistency 1 — "Start Game" has no host guard or player count check

**File**: `frontend/src/pages/LobbyPage.tsx`, line 72

The "Start Game" button is always rendered and always enabled for all participants. The business requirement states only the host can start the game and only when at least 2 players are present. Without a `hostId` on the room model and a minimum-participant check, this button will allow anyone to start the game with a single player.

---

### Inconsistency 2 — AppShell header copy describes WebSockets

**File**: `frontend/src/components/AppShell.tsx`, line 11

```
"A real-time multiplayer drawing and guessing game."
```

This copy implies WebSocket-level real-time synchronization, which is explicitly out of scope. The implementation uses HTTP polling. This is a cosmetic inconsistency but should not mislead feature expectations.
