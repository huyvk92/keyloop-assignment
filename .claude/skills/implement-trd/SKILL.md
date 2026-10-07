---
name: implement-trd
description: Implement tasks from docs/TRD.md phase by phase using TDD - delegates API/shared tasks to node-backend-developer and web tasks to react-frontend-developer, verifies with the quality gate, gets review from code-reviewer, and checks off completed tasks. Use after /create-trd, /init-react-app and /init-node-api.
argument-hint: [phase-N | T-001,T-002 | next]
disable-model-invocation: true
---

# Implement TRD

Scope: `$ARGUMENTS` (default `next` = the first unchecked task with its dependencies satisfied).

You are the **orchestrator**: you plan, delegate, verify, and own the result. Subagents write the
code; you do not trust their reports without checking.

## Loop (per task, in dependency order)

1. **Select**: read `docs/TRD.md` and resolve the scope into an ordered list of unchecked
   `- [ ] **T-xxx**` tasks. Show the plan to the user before starting a phase.
2. **Delegate by layer**. Send the task text, the referenced ACs/BRs from `docs/PRD.md`, the
   relevant TRD sections (contract, endpoints, DB schema), the file paths, and the reminder
   "TDD, quality gate must pass, report deviations":
   - `layer: api` / `shared` → `node-backend-developer`
   - `layer: web` → `react-frontend-developer`
   - `layer: full` → split it: backend first (contract + endpoint), then web with the final
     contract.
   Independent tasks may run in parallel, but never run a web task before the API/contract task
   it depends on.
3. **Verify yourself**. Never skip this step:
   - Run `npm run validate`
   - Read the diff: does it do what the task says, no more? Hallucinated packages or APIs?
   - Do the tests actually assert the acceptance criteria (not just "renders")?
   - Web: does it follow `react-best-practices` (state placement, all four UI states, a11y, stories)?
   - API: does it follow `node-api-best-practices` (layering, Clock, response schemas, 422 codes)?
     Hit the endpoint with `app.inject` or curl yourself; don't trust the report.
   - Contract: do `shared/`, the API route, the web consumer, and the MSW handlers agree?
4. **Fix or bounce**: small issues you fix directly; larger ones go back to the developer agent
   with specific feedback. Max 2 bounces, then stop and ask the user.
5. **Check off**: change `- [ ]` to `- [x]` for the task in `docs/TRD.md`.
   If the implementation deviated from the TRD, update the TRD and add a `TA-xx` assumption.

## End of phase

1. Run `test-engineer` to check AC coverage for the phase and fill gaps.
2. Run `code-reviewer`; resolve all BLOCKER/MAJOR findings.
3. Run `npm run validate && npm run build && npm run build-storybook -- --quiet`.
4. Append a phase entry to `docs/AI_COLLABORATION_LOG.md`: tasks done, issues found during
   verification, and corrections made.
5. Suggest a commit message (`feat(<feature>): ... [T-001, T-002]`); don't commit unless asked.

## Report

Tasks completed, tests added, gate status, review verdict, deviations, and the next task.
