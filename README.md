# Keyloop Assignment

A React + TypeScript application built with a spec-driven, AI-assisted workflow.

## AI-assisted workflow

This repo contains custom Claude Code **agents** (`.claude/agents/`) and **skills**
(`.claude/skills/`) that turn the assignment brief into a working, tested app:

```
/create-prd  ->  /create-trd  ->  /create-system-design  ->  /init-react-app  ->  /implement-trd  ->  /review-code
                         (anytime: /create-component, /log-ai-decision)
```

The stack and conventions are in [`react-best-practices`](.claude/skills/react-best-practices/SKILL.md):
React 19, TypeScript strict, Vite, Tailwind CSS v4, React Router, TanStack Query, Zustand,
React Hook Form + Zod, Vitest + Testing Library + MSW, Storybook 10, ESLint, Prettier, husky,
lint-staged, commitlint, and GitHub Actions CI.

| Document                       | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `docs/ASSIGNMENT.md`           | Original brief (verbatim)                            |
| `docs/PRD.md`                  | Product requirements, user stories, assumptions      |
| `docs/TRD.md`                  | Technical design and task breakdown                  |
| `docs/SYSTEM_DESIGN.md`        | System Design Document (submission deliverable)      |
| `docs/AI_COLLABORATION_LOG.md` | How AI was directed and how its output was validated |

## Getting started

Requires Node ≥ 20 (see `.nvmrc`) and git ≥ 2.27.

```bash
npm install
cp .env.example .env      # VITE_USE_MOCKS=true runs without a backend (MSW)
npm run dev               # http://localhost:5173
npm run storybook         # http://localhost:6006
npm run validate          # typecheck + lint + format + tests with coverage
```
