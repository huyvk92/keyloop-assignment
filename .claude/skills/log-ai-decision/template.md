# AI Collaboration Log

This log records how GenAI tools (Claude Code with custom agents and skills in `.claude/`) were
directed, how their output was validated, and which decisions were made by the developer.

## Workflow summary
PRD (`/create-prd`) -> TRD (`/create-trd`) -> System Design (`/create-system-design`) ->
Scaffold (`/init-react-app`) -> TDD implementation (`/implement-trd`) -> Review (`/review-code`)

## Validation principles
- No AI output is merged without passing type-check, lint, tests, and build
- Every acceptance criterion has a test written or reviewed by a human
- Reviewer findings are verified against the code before they're acted on

## Entries
