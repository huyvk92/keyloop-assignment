---
name: create-trd
description: Create a Technical Requirements Document (docs/TRD.md) from docs/PRD.md - React architecture, data models, API contracts, ADRs, and a phased task breakdown with checkbox-tracked task IDs. Use after /create-prd and before implementation.
argument-hint: [path/to/PRD.md]
---

# Create TRD

PRD path: `$ARGUMENTS` (default `docs/PRD.md`).

## Steps

1. **Read the PRD.** If it doesn't exist, stop and suggest `/create-prd`.
2. **Inspect the repo** (package.json, src/) so the design matches what already exists.
3. **Delegate** to the `tech-lead-architect` subagent with the PRD path, repo findings, and the
   template at [template.md](template.md). Target file: `docs/TRD.md`.
4. **Validate** the draft yourself:
   - Traceability: every `US-xxx` maps to at least one `T-xxx`, and every Must AC has a test plan
   - Tasks are small (≤ ~half a day), have `depends-on`, and form a valid order (no cycles)
   - Phase 1 is a thin vertical slice that is runnable end-to-end
   - All libraries named actually exist and fit the default stack, or have an ADR
   - Mock/backend strategy is explicit (MSW, json-server, or real API)
   Fix gaps with targeted edits.
5. **Log** the step in `docs/AI_COLLABORATION_LOG.md` (generated vs. what you changed).
6. **Report**: phases, task count, key ADRs, risks, next steps (`/create-system-design`,
   `/init-react-app`).
