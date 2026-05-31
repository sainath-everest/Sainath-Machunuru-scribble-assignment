<!--
SYNC IMPACT REPORT
==================
Version change: [template] → 1.0.0 (initial ratification)

Modified principles: N/A (initial creation from template)

Added sections:
  - Core Principles (6 principles)
  - Technical Constraints
  - Development Workflow
  - Governance

Removed sections: N/A (first fill of template)

Templates reviewed:
  - .specify/templates/plan-template.md  ✅ consistent — Constitution Check gate already present
  - .specify/templates/spec-template.md  ✅ consistent — acceptance criteria + edge-case structure aligns
  - .specify/templates/tasks-template.md ✅ consistent — phase/story ordering aligns with spec-driven principle

Follow-up TODOs: None — all placeholders resolved.
-->

# Scribble Constitution

## Core Principles

### I. TypeScript First (NON-NEGOTIABLE)

All source code in `backend/` and `frontend/` MUST be written in TypeScript with strict
typing enabled. Use of `any` is forbidden; use `unknown` for genuinely dynamic values and
narrow with type guards. ES Module syntax MUST be used throughout. Untyped code MUST NOT
be merged.

**Rationale**: Type safety eliminates an entire class of runtime bugs that are hard to
reproduce in a multiplayer, polling-based game and are invisible to manual browser testing.

### II. HTTP Polling Only (NON-NEGOTIABLE)

All client-server synchronization MUST use HTTP REST polling. WebSockets, Socket.io,
Server-Sent Events, and any other push or streaming protocol are strictly forbidden.
Polling intervals SHOULD be approximately 2 seconds for lobby and in-round state sync.

**Rationale**: The scope of this project is a focused brownfield enhancement. Introducing
real-time push infrastructure would expand complexity beyond the stated learning objectives
and violate the explicit project constraints.

### III. In-Memory Storage Only (NON-NEGOTIABLE)

All game state MUST be stored in server-side JavaScript objects (in-memory only). No SQL,
NoSQL, file-system, or any other persistent store MUST be used. Restarting the backend
MUST reset all rooms. Room cleanup for inactive sessions SHOULD be implemented to avoid
unbounded memory growth.

**Rationale**: Persistence infrastructure is out of scope. Keeping state in memory keeps
the implementation surface small and the data model legible.

### IV. Spec-Driven Development

All features MUST be driven by Spec Kit artifacts in the following order: `spec.md` →
clarification → `plan.md` → `tasks.md` → implementation. No feature implementation MUST
begin without a corresponding spec entry and an approved plan. Artifacts MUST be committed
alongside or before the implementing code changes.

**Rationale**: The lab evaluation is based on traceability between artifacts and code.
Spec-first discipline ensures AI-generated output is reviewed and understood before
being committed, not reverse-engineered from working code.

### V. Deterministic Game Rules

Game logic MUST produce deterministic, reproducible outcomes given the same inputs:
- Secret word selection MUST use the fixed starter word list in a defined order.
- Drawer assignment MUST follow a defined rule (e.g., first player / host).
- Scoring MUST award exactly 100 points for a correct guess and 0 for an incorrect guess.
- Guess comparison MUST be case-insensitive and applied to the trimmed guess string.
- Empty or whitespace-only player names and guesses MUST be rejected with a user-visible error message.

**Rationale**: Non-determinism makes acceptance testing across two browser tabs unreliable
and makes the spec ambiguous. Deterministic rules make every acceptance scenario reproducible.

### VI. AI Review Discipline

AI-generated code MUST be reviewed against the spec and plan before being committed.
Commits MUST be granular and traceable to a specific task in `tasks.md`. Wholesale
acceptance of AI output without validation is forbidden. Each commit message SHOULD
reference the task ID it implements.

**Rationale**: The lab explicitly evaluates whether the engineer understands and can
explain every change. Unreviewed AI output creates drift between spec and implementation
that is penalized during evaluation.

## Technical Constraints

- **Backend**: Node.js 18+, Express, TypeScript, Zod (validation), `tsx` (execution).
  Zod schemas MUST be defined for all request payloads and response shapes.
- **Frontend**: React 18, React Router v6, Vite, TypeScript. Functional components and
  hooks only; class components MUST NOT be introduced.
- **State Management**: Follow the `roomStore.ts` Zustand/Context pattern already present
  in `frontend/src/state/`. New state slices MUST use the same pattern.
- **Styling**: CSS MUST reside in `app.css` or scoped CSS modules. Inline styles and
  third-party CSS-in-JS libraries are discouraged.
- **Out of scope (MUST NOT build)**: WebSockets, databases, authentication, multiple
  rounds/rotation, timers, custom word packs, spectator mode, moderation, room passwords,
  rewriting the starter from scratch, new routing/state libraries, unjustified dependencies,
  deployment/CI/Docker work.

## Development Workflow

1. **Discovery first**: Read relevant starter files; document at least 3 incomplete
   behaviors and 2 assumptions before writing any spec entry.
2. **Spec before plan**: A `spec.md` entry with acceptance criteria MUST exist before a
   `plan.md` is created for that feature group.
3. **Plan before tasks**: A `plan.md` with state model and file-level design MUST exist
   before `tasks.md` is generated.
4. **Incremental implementation**: Complete one scenario checkpoint at a time; validate
   in two browser tabs before advancing to the next scenario.
5. **Build gate**: Both `backend/npm run build` and `frontend/npm run build` MUST pass
   cleanly before any PR is raised.
6. **Commit hygiene**: Commits MUST be granular (one logical change per commit), meaningful,
   and traceable to a task ID. Force-pushing to `main` is forbidden.

## Governance

This constitution supersedes all other ad-hoc practices and verbal agreements. Any
amendment MUST be documented with a version bump following semantic versioning:
- **MAJOR**: Removal or incompatible redefinition of a Core Principle.
- **MINOR**: Addition of a new principle or materially expanded guidance.
- **PATCH**: Clarifications, wording improvements, or non-semantic refinements.

All pull requests MUST verify compliance with the Core Principles before merge. Complexity
deviations from the Technical Constraints MUST be explicitly justified in the plan's
Complexity Tracking table. Refer to `AGENTS.md` for runtime agent development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-01 | **Last Amended**: 2026-06-01
