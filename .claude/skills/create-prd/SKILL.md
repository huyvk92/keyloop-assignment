---
name: create-prd
description: Create a Product Requirements Document (docs/PRD.md) from an assignment brief, pasted requirements, or a file path. Use when starting a new feature or project and requirements need to be structured into user stories, acceptance criteria, and documented assumptions.
argument-hint: <requirements text | path/to/brief.md>
---

# Create PRD

Input: `$ARGUMENTS`

## Steps

1. **Collect the source.** If `$ARGUMENTS` is a file path, read it. If empty, look for
   `docs/ASSIGNMENT.md` or `README.md`; if nothing is found, ask the user to paste the brief.
   Save the raw brief verbatim to `docs/ASSIGNMENT.md` if it isn't already there.
2. **Find ambiguities.** List every unclear point (scope, users, data, edge cases, NFRs).
   Ask the user about at most 3 *blocking* questions. For everything else, choose a reasonable
   assumption; don't ask.
3. **Delegate drafting** to the `business-analyst` subagent with: the brief, the ambiguity list,
   the user's answers, and the template at [template.md](template.md). Target file: `docs/PRD.md`.
4. **Validate** the draft yourself before accepting it:
   - Every Must story has ≥1 testable Given/When/Then acceptance criterion
   - Every ambiguity maps to an `A-xx` assumption with a rationale
   - Every business rule `BR-xx` is covered by at least one acceptance criterion
   - No implementation details (frameworks, code) leaked into the PRD
   - Hard constraints from the brief are quoted in "Source constraints"
   Fix any gaps with targeted edits.
5. **Log** a one-line entry to `docs/AI_COLLABORATION_LOG.md` (see the `log-ai-decision` skill)
   noting what was generated and what you corrected.
6. **Report** to the user: story count by priority, assumptions made, open questions, and the
   next step (`/create-trd`).
