# API Contracts: Gameplay Interaction (Scenario 3)

All Scenario 1 and 2 endpoints (`POST /rooms`, `POST /rooms/:code/join`,
`GET /rooms/:code`, `POST /rooms/:code/start`, `GET /rooms/:code/game`) are **unchanged**
except that `GET /rooms/:code/game` now returns an extended `GameSnapshot` with
`strokes`, `guesses`, and `scores` added to the base fields.

---

## Updated Response Type: `GameSnapshot`

Both drawer and guesser views now include the three new fields. The `secretWord`
conditional from Scenario 2 is unchanged.

```json
{
  "code": "AB12",
  "status": "playing",
  "roundNumber": 1,
  "drawerId": "uuid-drawer",
  "participants": [
    { "id": "uuid-drawer", "name": "Alice", "joinedAt": "2026-06-01T17:00:00.000Z" },
    { "id": "uuid-guesser", "name": "Bob",   "joinedAt": "2026-06-01T17:00:10.000Z" }
  ],
  "strokes": [
    [{ "x": 10, "y": 20 }, { "x": 15, "y": 25 }, { "x": 20, "y": 30 }],
    [{ "x": 50, "y": 50 }, { "x": 60, "y": 55 }]
  ],
  "guesses": [
    {
      "participantId": "uuid-guesser",
      "text": "rocket",
      "correct": false,
      "submittedAt": "2026-06-01T17:01:00.000Z"
    }
  ],
  "scores": {
    "uuid-drawer":  0,
    "uuid-guesser": 0
  },
  "secretWord": "pizza"   // present ONLY when participantId == drawerId
}
```

---

## New Endpoint: `POST /rooms/:code/canvas/stroke`

Appends one completed freehand stroke to the server-side drawing state.

**Request**

```
POST /rooms/AB12/canvas/stroke
Content-Type: application/json

{
  "participantId": "uuid-drawer",
  "points": [
    { "x": 100, "y": 200 },
    { "x": 110, "y": 210 },
    { "x": 120, "y": 220 }
  ]
}
```

**Success `200 OK`**

```json
{ "game": { /* GameSnapshot — drawer view (includes secretWord) */ } }
```

**Error cases**

| Status | Message | Condition |
|--------|---------|-----------|
| 400 | "Stroke must contain at least one point" | `points` is empty array |
| 400 | "Participant ID is required" | `participantId` missing or blank |
| 403 | "Only the drawer can modify the canvas" | `participantId` ≠ `drawerId` |
| 404 | "Unable to load room" | Room code not found |
| 409 | "Game has not started yet" | Room status is not `"playing"` |

---

## New Endpoint: `DELETE /rooms/:code/canvas`

Empties the drawing state. All strokes are removed; guessers see a blank canvas on next poll.

**Request**

```
DELETE /rooms/AB12/canvas
Content-Type: application/json

{
  "participantId": "uuid-drawer"
}
```

**Success `200 OK`**

```json
{ "game": { /* GameSnapshot — drawer view; strokes: [] */ } }
```

**Error cases**

| Status | Message | Condition |
|--------|---------|-----------|
| 400 | "Participant ID is required" | `participantId` missing or blank |
| 403 | "Only the drawer can modify the canvas" | `participantId` ≠ `drawerId` |
| 404 | "Unable to load room" | Room code not found |
| 409 | "Game has not started yet" | Room status is not `"playing"` |

---

## New Endpoint: `POST /rooms/:code/guess`

Submits a text guess from a guesser, compares it to the secret word (case-insensitive,
trimmed), records the result, and scores if this is the participant's first correct guess.

**Request**

```
POST /rooms/AB12/guess
Content-Type: application/json

{
  "participantId": "uuid-guesser",
  "text": "  PIZZA  "
}
```

**Success `200 OK`**

```json
{ "game": { /* GameSnapshot — guesser view; no secretWord; updated scores + guesses */ } }
```

The `game` in the response reflects the state immediately after the guess is processed.
The guesser does not need to wait for the next poll cycle to see their score change.

**Success `200 OK` — correct guess, first time (score 0 → 100)**

```json
{
  "game": {
    "scores": { "uuid-guesser": 100, "uuid-drawer": 0 },
    "guesses": [
      {
        "participantId": "uuid-guesser",
        "text": "pizza",
        "correct": true,
        "submittedAt": "2026-06-01T17:02:00.000Z"
      }
    ]
  }
}
```

**Success `200 OK` — correct guess, second time (score already 100, no increment)**

```json
{
  "game": {
    "scores": { "uuid-guesser": 100, "uuid-drawer": 0 },
    "guesses": [
      { "text": "pizza", "correct": true, ... },
      { "text": "pizza", "correct": true, ... }
    ]
  }
}
```

**Error cases**

| Status | Message | Condition |
|--------|---------|-----------|
| 400 | "Guess cannot be empty" | Trimmed `text` is `""` |
| 400 | "Guess text is required" | `text` field missing entirely |
| 400 | "Participant ID is required" | `participantId` missing or blank |
| 403 | "Drawer cannot submit guesses" | `participantId` === `drawerId` |
| 404 | "Unable to load room" | Room code not found |
| 404 | "Participant not found" | `participantId` not in `room.participants` |
| 409 | "Game has not started yet" | Room status is not `"playing"` |

---

## Polling Strategy (unchanged from Scenario 2)

All players poll `GET /rooms/:code/game?participantId=...` at ~2s while on the game screen.
This single response now carries `strokes`, `guesses`, and `scores` in addition to the
Scenario 2 fields. No separate polling endpoints are introduced for Scenario 3.

After a guesser submits a guess (`POST /rooms/:code/guess`), the response body already
contains the updated `GameSnapshot`. The client can apply this directly to the store state
without waiting for the next poll cycle.

After the drawer submits a stroke (`POST /rooms/:code/canvas/stroke`), the response contains
the updated snapshot. Other participants see the stroke on their next poll cycle (~2s).

---

## Endpoint Summary

| Method | Path | Scenario | Who calls it |
|--------|------|----------|-------------|
| POST | `/rooms` | 1 | Host |
| POST | `/rooms/:code/join` | 1 | Non-host |
| GET | `/rooms/:code` | 1+2 | All (lobby polling) |
| POST | `/rooms/:code/start` | 2 | Host only |
| GET | `/rooms/:code/game` | 2+3 | All (game polling) |
| POST | `/rooms/:code/canvas/stroke` | **3** | Drawer only |
| DELETE | `/rooms/:code/canvas` | **3** | Drawer only |
| POST | `/rooms/:code/guess` | **3** | Guessers only |
