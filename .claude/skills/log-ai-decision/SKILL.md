---
name: log-ai-decision
description: Append an entry to docs/AI_COLLABORATION_LOG.md recording how AI was directed, what it produced, how the output was validated, and what was accepted, corrected, or rejected. Use after any significant AI-generated artifact or whenever AI output was corrected.
argument-hint: <short note about what happened>
---

# Log AI Decision

Note: `$ARGUMENTS`

This log is evidence for the evaluation criterion "ability to direct, validate, and take ownership
of AI-generated work". Keep entries short, factual, and specific.

1. If `docs/AI_COLLABORATION_LOG.md` doesn't exist, create it with the header in
   [template.md](template.md).
2. Using the note plus the current conversation context, append one entry:

```markdown
### YYYY-MM-DD · <step, e.g. create-trd / T-004>
- **Goal**: what I asked the AI to do
- **Agent/skill**: e.g. tech-lead-architect via /create-trd
- **AI output**: one-line summary
- **Validation**: tests / type-check / manual review / reviewer agent: result
- **Human decision**: Accepted | Modified | Rejected, plus why
- **Corrections**: concrete changes (e.g. "removed hallucinated `react-query-utils` dependency")
```

3. Don't invent details. If something is unknown, ask the user or leave it out.
