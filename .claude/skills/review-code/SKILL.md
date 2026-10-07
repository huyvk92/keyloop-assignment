---
name: review-code
description: Run the quality gate and a structured code review (correctness, security, accessibility, tests, AI-generated code smells) against PRD/TRD. Use after a phase is implemented or before submitting the assignment.
argument-hint: [path | feature | "all"]
---

# Review Code

Scope: `$ARGUMENTS` (default: uncommitted changes if there are any, otherwise `src/`).

## Steps

1. Run the quality gate and capture the output:
   `npm run validate; npm run build; npm run build-storybook -- --quiet`
2. In parallel, delegate:
   - `code-reviewer`: full checklist review of the scope
   - `test-engineer`: AC to test coverage map from `docs/PRD.md`
3. **De-duplicate and verify** the findings. Open each referenced file and line, and drop any
   finding you can't confirm (reviewers can hallucinate too).
4. Write `docs/reviews/REVIEW-<YYYY-MM-DD>.md` containing the gate results, a findings table by
   severity, the AC coverage map, and the verdict.
5. Ask the user whether to auto-fix BLOCKER/MAJOR findings. If yes, delegate the fixes to
   `react-frontend-developer` and re-run the gate.
6. Log a summary in `docs/AI_COLLABORATION_LOG.md`.
