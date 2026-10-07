---
name: implement-trd
description: Implement tasks from docs/TRD.md phase by phase using TDD - delegates to react-frontend-developer, verifies with the quality gate, gets review from code-reviewer, and checks off completed tasks. Use after /create-trd and /init-react-app.
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
2. **Delegate**: send the task to `react-frontend-developer` with the task text, the referenced
   ACs from `docs/PRD.md`, the relevant file paths, and the reminder "TDD, quality gate must pass,
   report deviations". Independent tasks within a phase may run in parallel.
3. **Verify yourself**. Never skip this step:
   - Run `npm run validate`
   - Read the diff: does it do what the task says, no more? Hallucinated packages or APIs?
   - Do the tests actually assert the acceptance criteria (not just "renders")?
   - Does it follow `react-best-practices` (state placement, all four UI states, a11y, stories)?
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
