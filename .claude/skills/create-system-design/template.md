# System Design Document: <Product name>

## 1. Overview
<Problem, solution summary, and how to run it.>

## 2. Requirements summary
- Functional: link to `docs/PRD.md`, key stories
- Non-functional: accessibility, performance, security

## 3. Assumptions
| ID | Assumption | Rationale | Impact if wrong |
| -- | ---------- | --------- | --------------- |

## 4. High-level architecture
```mermaid
flowchart TB
```
<Component responsibilities.>

## 5. Frontend design
- Component hierarchy & routing
- State management (server vs. client)
- Data validation & API layer
- Error, loading & empty states

## 6. Data model & API contracts

## 7. Key design decisions & trade-offs
| Decision | Alternatives | Why chosen | Trade-off |
| -------- | ------------ | ---------- | --------- |

## 8. Quality strategy
- Testing pyramid & coverage
- Accessibility
- Security considerations

## 9. Scalability & future improvements
<What changes with 10x users/data/team size; what would come next.>

## 10. AI-assisted development process
- Workflow: PRD -> TRD -> scaffold -> TDD implementation -> review
- Agents & skills used (`.claude/`) and why
- Verification methods: tests, type-check, lint, manual review, code-reviewer agent
- Notable corrections of AI output (from `docs/AI_COLLABORATION_LOG.md`)
