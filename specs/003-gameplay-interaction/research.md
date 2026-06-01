# Research: Gameplay Interaction (Scenario 3)

All decisions were resolved during the Scenario 3 clarification session (2026-06-01).
No external research is required — every question was answered by the spec and constitution.

---

## Decision 1 — Drawing Synchronisation Strategy

**Decision**: Strokes are stored server-side in `currentRound.strokes`
(`Array<Array<{x: number, y: number}>>`) and returned in every `GET /rooms/:code/game`
response. Guessers re-render the canvas from this array on each ~2s poll.

**Rationale**: The game is unplayable if guessers cannot see the drawing. WebSockets are
forbidden by the constitution. HTTP polling at ~2s gives a laggy but entirely functional
sync within the existing architectural pattern established in Scenarios 1 and 2.

**Alternatives considered**:
- Canvas drawer-local only → rejected; guessers could not see the drawing
- Base64 PNG transmission → rejected; prohibitively large per-poll payload; no clear-point
  semantics
- SVG path strings → rejected; harder to render incrementally on an HTML5 canvas

---

## Decision 2 — Canvas Update Mechanism

**Decision**: The drawer's browser emits one `POST /rooms/:code/canvas/stroke` per completed
stroke (pen-down → pen-up cycle). "Clear Canvas" sends `DELETE /rooms/:code/canvas` which
empties `currentRound.strokes` to `[]`. Storage format: `Array<Array<{x: number, y: number}>>`
— outer array is all strokes; inner array is the ordered `{x, y}` points of one stroke.

**Rationale**: Per-stroke batching avoids the hundreds-of-requests-per-second problem of
per-point streaming while still delivering updates within one pen stroke. Per-stroke is the
natural semantic unit of a drawing and maps cleanly to mouse-down → mousemove* → mouseup
events. The clear operation is a single idempotent DELETE, matching REST conventions.

**Alternatives considered**:
- Per-point streaming → rejected; ~100+ requests per stroke on a typical drawing
- Full canvas every 2s → rejected; misaligns with stroke semantics and wastes bandwidth on
  unchanged state; also requires storing the same strokes twice (client buffer + server state)

---

## Decision 3 — Scoring Cap per Participant

**Decision**: Each participant's correct-guess score increment is capped at one event per
round. A second correct submission from the same participant is appended to history as
`correct: true` but adds 0 to `currentRound.scores[participantId]`.

**Implementation rule**: Before incrementing, check
`currentRound.scores[participantId] === 0`. Only increment if the score is still 0.
(This assumes participants start at 0 and 100 means "already scored", which is correct per
the spec. If a participant's score is 100, no further increment is applied.)

**Rationale**: Standard Scribble game rules — one correct guess per guesser per word.
Prevents trivial score inflation via repeated correct submissions.

**Alternatives considered**:
- Unbounded re-scoring → rejected; makes the scoreboard meaningless

---

## Decision 4 — `POST /rooms/:code/guess` Response Shape

**Decision**: Returns `{ game: GameSnapshot }` — the full updated game snapshot including
`scores`, `guesses`, and `strokes` for the submitting participant's role view.

**Rationale**: Immediate feedback without requiring the guesser to wait up to 2s for the
next poll cycle. Consistent with how `POST /rooms/:code/start` already returns `{ room: RoomSnapshot }`.
The same `toGameSnapshot` function is reused — no new serialisation logic needed.

**Alternatives considered**:
- `{ correct: boolean }` minimal ACK → rejected; introduces a 2s delay before score feedback
- `204 No Content` → rejected; forces the client to poll for its own score change

---

## Decision 5 — Unknown `participantId` on Guess Submission

**Decision**: `POST /rooms/:code/guess` validates that `participantId` exists in
`room.participants`. Returns `404 Not Found` with `"Participant not found"` if absent or
unknown.

**Rationale**: Consistent with the game-rule integrity approach used throughout Scenarios 1
and 2 (host-only start = 403; start on non-existent room = 404). Prevents fabricated IDs
from affecting scores.

**Alternatives considered**:
- Accept any non-drawer ID → rejected; allows anonymous score manipulation

---

## Decision 6 — `toGameSnapshot` Extension Strategy

**Decision**: Extend `toGameSnapshot` additively — add `strokes`, `guesses`, `scores` to
the shared base returned for both drawer and guesser. The `secretWord` conditional remains
unchanged from Scenario 2. No Scenario 2 caller is broken because the new fields are
additions, not modifications.

**Rationale**: `toGameSnapshot` is already the single serialisation point for game state.
Adding fields there is the smallest possible change surface and keeps the function as the
authoritative snapshot builder.

---

## Decision 7 — Canvas Endpoint Authorization

**Decision**: Both `POST /rooms/:code/canvas/stroke` and `DELETE /rooms/:code/canvas` require
`participantId` in the request body and validate it equals `currentRound.drawerId`. Non-drawer
calls return `403 Forbidden: "Only the drawer can modify the canvas"`. Room-not-found returns
`404`; game-not-started returns `409`.

**Rationale**: Mirrors the host-only validation pattern from `POST /rooms/:code/start`. No
UI-only gating is sufficient for game-rule integrity.

---

## Decision 8 — Score Initialization in `startGame`

**Decision**: `startGame` is extended additively to initialize three new `Round` fields:
`strokes: []`, `guesses: []`, `scores: Record<participantId, 0>` for all current participants.
This is an additive change to the Scenario 2 `startGame` — the function signature, callers,
and HTTP contract are all unchanged.

**Rationale**: Scores must be keyed by `participantId` from round start so the scoreboard can
display 0 for all players before any guesses are submitted. Initializing in `startGame` is
the single natural insertion point (avoids lazy-init branching in `submitGuess`).
