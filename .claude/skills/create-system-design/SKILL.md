---
name: create-system-design
description: Create the System Design Document (docs/SYSTEM_DESIGN.md) required by the assignment, consolidating PRD and TRD into architecture, design rationale, assumptions, trade-offs, scalability, and an AI-collaboration section. Use after /create-trd or before submission to refresh it.
argument-hint: [focus area]
---

# Create System Design Document

Optional focus: `$ARGUMENTS`

This is a **submission deliverable**. Reviewers read it to understand your reasoning, so it must be
accurate to the code that actually exists, not to the plan.

## Steps

1. Read `docs/PRD.md`, `docs/TRD.md`, `docs/AI_COLLABORATION_LOG.md`, and scan `src/` if present.
2. Delegate to `tech-lead-architect` with the template at [template.md](template.md).
   Target: `docs/SYSTEM_DESIGN.md`.
3. Validate:
   - **All** assumptions (`A-xx`, `TA-xx`) are listed with rationale; this is explicitly required
   - Diagrams reflect the real code structure (verify against `src/`)
   - Trade-offs section states what was *not* done and why
   - The AI collaboration section is concrete: what was delegated, how it was verified, and
     what was rejected or corrected
4. Report the sections and anything that is still planned rather than implemented.
