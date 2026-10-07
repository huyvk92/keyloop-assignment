# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Context

This is a take-home assignment for Keyloop. The evaluation focuses on **how the developer directs,
validates, and takes ownership of AI-generated work**, not only the final code. Therefore:

- Every non-trivial decision must be traceable to a document in `docs/`.
- Ambiguous requirements are resolved by an explicit, documented **assumption** (never silently).
- AI output is never accepted without verification (tests, type-check, lint, review).
- Notable AI interactions are recorded in `docs/AI_COLLABORATION_LOG.md` (use `/log-ai-decision`).

## Tech stack (frontend)

Full rules and the approved library list are in `.claude/skills/react-best-practices/SKILL.md`.

- React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8, `@/` alias to `src/`
- Tailwind CSS v4 (`@tailwindcss/vite`), `cn()` = clsx + tailwind-merge
- `react-router` (data router, lazy routes), `react-error-boundary`
- State: TanStack Query (server), Zustand (shared client), URL params (shareable), `useState` (local)
- Forms: React Hook Form + Zod; Zod also validates API responses and env (`lib/env.ts`)
- Tests: Vitest + React Testing Library + MSW (shared handlers in `src/mocks/`)
- Storybook 10 (CSF Next) with docs, a11y, and MSW addons
- ESLint 9 (a11y, query, testing-library, storybook plugins), Prettier, husky + lint-staged +
  commitlint (Conventional Commits), GitHub Actions CI

## Spec-driven workflow

Run the skills in order. Each step consumes the previous step's output.

| Step | Skill                                | Output                                             |
| ---- | ------------------------------------ | -------------------------------------------------- |
| 1    | `/create-prd <requirements or file>` | `docs/PRD.md`                                      |
| 2    | `/create-trd`                        | `docs/TRD.md` (task breakdown with IDs)            |
| 3    | `/create-system-design`              | `docs/SYSTEM_DESIGN.md` (required deliverable)     |
| 4    | `/init-react-app [dir]`              | Scaffolded React app (includes `/setup-storybook`) |
| 5    | `/implement-trd [phase or task ids]` | Code + tests + stories, TRD checkboxes updated     |
| 6    | `/review-code [scope]`               | Review report + quality gate result                |
| any  | `/create-component <Name> [feature]` | Component + test + story                           |
| any  | `/log-ai-decision <note>`            | Entry in `docs/AI_COLLABORATION_LOG.md`            |

`react-best-practices` is a reference skill that the developer, tester, reviewer, and architect
agents preload automatically.

## Subagents (`.claude/agents/`)

| Agent                      | Role                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `business-analyst`         | BA: elicits requirements, business rules, process flows, user stories, acceptance criteria, assumptions (PRD) |
| `tech-lead-architect`      | Writes TRD and System Design, makes architecture decisions (ADRs)                                             |
| `react-frontend-developer` | Implements React/TS features from TRD tasks, TDD                                                              |
| `test-engineer`            | Writes and hardens unit/integration/E2E tests, checks coverage                                                |
| `code-reviewer`            | Read-only review for correctness, security, a11y, maintainability                                             |

## Coding conventions (summary)

- `src/app` (shell) · `src/pages` (thin routes) · `src/features/<f>` (public API via `index.ts`) ·
  `src/components` (shared UI + stories) · `src/stores` · `src/lib` · `src/mocks` · `src/test`
- Imports use `@/`; no `../` imports and no deep imports into other features (enforced by ESLint)
- No `any`, no `enum`; named exports; `type Props = {...}`; component files export only components
- Never copy API data into Zustand; read stores via selectors; register stores in `src/test/setup.ts`
- Style with Tailwind utilities only; tokens in `@theme` in `src/index.css`
- Every task ships tests (by role/label); shared and multi-state components ship stories
- Data-driven UI renders loading, error, empty, and success states

## Quality gate (must pass before a task is marked done)

```bash
npm run validate          # typecheck + lint + format:check + tests with coverage thresholds
npm run build             # before ending a phase
npm run build-storybook   # before ending a phase
```
