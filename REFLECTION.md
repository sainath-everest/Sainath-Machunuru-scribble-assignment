# Reflection

## What the starter app already had

When I first opened the repo it felt more complete than it actually was. There was a working Express backend, a React frontend, room creation and joining, a lobby screen, even a `DrawingCanvas` component. It looked like a game. But none of the pieces were connected — no polling, no drawing sync, no guessing, no scores, nothing that actually made it playable.

The foundation was solid though. Zod validation, TypeScript throughout, a clean in-memory room store with a `Map`. I didn't have to fight the codebase, I just had to build on top of it.

## What I added

I worked through four scenarios in order, each one unlocking the next:

- **Lobby polling** — `GET /rooms/:code` every ~2s so everyone in the lobby sees players join in real time without refreshing.
- **Game start + drawing** — word selection, role assignment (drawer vs guesser), canvas stroke sync via `POST /canvas/stroke`.
- **Guessing + scoring** — `POST /rooms/:code/guess` with case-insensitive matching and 100 points for the first correct guess. Live activity feed visible to all.
- **Round end + restart** — host ends the round, everyone sees a result screen with the secret word, scores, and full guess history. Host can restart; non-host players are redirected automatically via the existing game poll.

## How I used AI

I used Spec Kit as a structured workflow rather than just asking the AI to write code. For each scenario I went through: specify → clarify → plan → tasks → implement. The clarify step was the most valuable part — I had the AI ask me pointed questions about things the spec left ambiguous before any code was written.

For example, on the result screen I hadn't decided whether the canvas drawing should be shown. The AI surfaced it as a question, gave me options with tradeoffs, and I decided: no canvas on the result screen, keep it clean. That kind of decision would have been easy to skip and painful to undo later.

The AI also caught things I would have glossed over — like making the "End Round" button host-only on the frontend, not just server-side. Small thing, but it matters for UX.

## Tradeoffs I made

**Polling over WebSockets** — the spec required it and honestly for this scale it works fine. The ~2s lag is noticeable if you're watching closely but it's not jarring for a casual game.

**Single round, no timer** — I kept strictly to what each scenario asked for. No auto-end, no countdown, no multi-round tracking. The host ends manually. It feels a little manual but it kept scope clean and the behavior predictable.

**Non-host restart detection via 409** — instead of adding a new endpoint or a separate poll, I reused the existing `GET /rooms/:code/game` poll. When a non-host player is on the result screen and the host restarts, the next poll returns a 409 ("Game has not started yet"). I flag that as "restart detected" and navigate to lobby. It's a bit clever but it means one less endpoint and no changes to the polling architecture.

## What I'd do differently

I'd write integration tests earlier. The unit tests for the service layer were fast and caught logic bugs, but a few real issues only showed up in the browser — like the `.panel` CSS class having `overflow: hidden` which was silently clipping the entire scoreboard on the result screen. A test that actually rendered the component against a real API response would have caught that in seconds.
