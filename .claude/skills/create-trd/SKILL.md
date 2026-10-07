---
name: create-trd
description: Create a Technical Requirements Document (docs/TRD.md) from docs/PRD.md - web (React) and API (Node.js) architecture, shared Zod contract, REST endpoints, SQLite schema, ADRs, and a phased task breakdown with layer-tagged, checkbox-tracked task IDs. Use after /create-prd and before implementation.
argument-hint: [path/to/PRD.md]
---

# Create TRD

PRD path: `$ARGUMENTS` (default `docs/PRD.md`).

## Steps

1. **Read the PRD.** If it doesn't exist, stop and suggest `/create-prd`.
2. **Inspect the repo** (`package.json`, `src/`, `server/`, `shared/`) so the design matches what
   already exists. If `server/` is missing, plan `/init-node-api` as the first task.
3. **Delegate** to the `tech-lead-architect` subagent with the PRD path, repo findings, and the
   template at [template.md](template.md). Target file: `docs/TRD.md`.
4. **Validate** the draft yourself:
   - Traceability: every `US-xxx` maps to at least one `T-xxx`, and every Must AC has a test plan
   - Tasks are small (≤ ~half a day), have `depends-on`, and form a valid order (no cycles)
   - Phase 1 is a thin vertical slice that is runnable end-to-end
   - All libraries named actually exist and fit the default stack, or have an ADR
   - Every endpoint has a Zod contract in the shared section, status codes, and error codes
   - Every BR is assigned to a layer (API, web, or both) and server-side enforcement covers BR-18
   - The DB schema has constraints and indexes for every filter and sort the PRD needs
   - Every task has a `layer` (`api`/`web`/`shared`/`full`), and API tasks precede their web consumers
   - MSW handlers (tests/Storybook) are planned to match the real contract
   Fix gaps with targeted edits.
5. **Log** the step in `docs/AI_COLLABORATION_LOG.md` (generated vs. what you changed).
6. **Report**: phases, task count, key ADRs, risks, next steps (`/create-system-design`,
   `/implement-trd phase-1`).
