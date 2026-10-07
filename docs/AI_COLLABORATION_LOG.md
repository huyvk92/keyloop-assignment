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

### 2026-10-07 · tooling / init-react-app

- **Goal**: Define React best practices, a library stack, and scaffold/Storybook skills for the repo.
- **Agent/skill**: Claude Code (main session) authoring `.claude/skills/{react-best-practices,init-react-app,setup-storybook,create-component}`.
- **AI output**: The first draft of the skills was written from memory (configs and library APIs).
- **Validation**: Ran the whole scaffold in a throwaway folder: `npm run validate` (15 tests,
  98% coverage), `npm run build`, `npm run build-storybook`, and commitlint accept/reject checks.
- **Human decision**: Modified. `reference.md` is now generated from the verified files, not from memory.
- **Corrections** (assumptions in the first draft that turned out wrong):
  - `create-vite` now ships oxlint, not ESLint. Switched to ESLint because the a11y, query,
    testing-library, and storybook plugins are ESLint-only.
  - ESLint 10 conflicts with `eslint-plugin-jsx-a11y`, so ESLint is pinned to v9.
  - The package is `react-router` (now v8), not `react-router-dom`.
  - Storybook 10 + msw-storybook-addon v3: the CSF3 `mswLoader` is deprecated, so the setup uses
    CSF Next (`definePreview`).
  - `erasableSyntaxOnly` rejects TS parameter properties, so `HttpError` uses explicit fields.
  - The react-refresh rule rejected a helper exported from `providers.tsx`; it moved to `lib/query-client.ts`.
  - Function coverage was 74%, below the 80% threshold; added App/ErrorFallback/RouteError tests.
  - lint-staged needs git ≥ 2.32 (this machine has 2.27); a precondition check was added to the skill.

### 2026-10-07 · init-react-app (repository scaffold)

- **Goal**: Scaffold the React app in the repository root by following `/init-react-app`.
- **Agent/skill**: Claude Code (main session) running the `init-react-app` + `setup-storybook` steps.
- **AI output**: The app shell, configs, tests, and Storybook, copied from the scaffold verified in the
  throwaway folder (keeping the existing README, CLAUDE.md, `.claude/`, and `docs/`).
- **Validation**: `npm run validate` passed (15 tests; 97.8% statements, 95.8% branches);
  `npm run build` passed and the CSS contains the Tailwind utilities; `npm run build-storybook`
  passed; commitlint rejected "bad message" and accepted "chore: scaffold".
- **Human decision**: Modified.
- **Corrections**: `format:check` failed on 18 markdown files in `.claude/`, `docs/`, and the root.
  Added `.claude` to `.prettierignore` (its reference code must stay byte-identical) and formatted
  the deliverable docs. The skill's reference now includes this ignore rule.
- **Not verified**: the lint-staged pre-commit hook (local git 2.27 < 2.32 required) and
  `npm run dev` with MSW in a real browser.

### 2026-10-07 · git hooks (lint-staged)

- **Goal**: Get the pre-commit hook working on this machine (git 2.27).
- **Agent/skill**: Claude Code (main session).
- **AI output**: Tried `brew upgrade git` first. It failed because Homebrew on macOS Monterey
  requires Xcode Command Line Tools, and the installed Xcode 12.1 is too old.
- **Validation**: Found that lint-staged v15/v16 have no minimum git version check, then tested
  v16 with real commits in a throwaway repo. It rejects a bad commit message, accepts a
  conventional one, blocks a commit containing `any`, and auto-formats staged code.
- **Human decision**: Modified. Pinned `lint-staged@^16` instead of requiring a system upgrade.
- **Corrections**: The commit test exposed a config bug that would occur on any git version:
  staged files ignored by ESLint (`public/mockServiceWorker.js`) produce a warning, which
  `--max-warnings=0` turns into a failed commit. Added `--no-warn-ignored`. The skill and its
  reference are updated.

### 2026-10-07 · create-prd

- **Goal**: Turn the Keyloop "Intelligent Inventory Dashboard" brief into a PRD.
- **Agent/skill**: `/create-prd` → `business-analyst` subagent.
- **AI output**: `docs/PRD.md` with 14 stories (7 Must, 5 Should, 1 Could, 1 Won't), 18 business
  rules, 55 Given/When/Then acceptance criteria, 10 NFRs, 15 assumptions, 2 process flows.
- **Human input**: One blocking question was asked: where persistence lives. The user chose a
  real Node.js backend with seeded mock data (recorded as A-03). The other 14 ambiguities were
  settled with assumptions I set before delegating.
- **Validation**: Checked every Must story for testable ACs, every BR for AC coverage, and the
  PRD for technology leakage. Recomputed the boundary dates (2026-07-09 = 90 days,
  2026-07-08 = 91) and the KPI example (mean 601/8 = 75; aging 3/8 = 37.5%); both are correct.
- **Human decision**: Modified.
- **Corrections**: (1) BR-18 (server-side validation) had no AC for BR-12. Added a
  service-level rejection of an empty "Logged by" to AC-006.4 and to the traceability table.
  (2) AC-001.7 silently assumed GBP; made it explicit in A-13.

### 2026-10-07 · init-node-api (backend tooling + scaffold)

- **Goal**: Add a Node.js backend (the user's decision during `/create-prd`), with skills and an
  agent so backend TRD tasks can be delegated and verified like frontend ones.
- **Agent/skill**: Claude Code (main session). Created `node-api-best-practices`,
  `init-node-api` (with a verified `reference.md`), and the `node-backend-developer` agent.
  Updated `create-trd`, `implement-trd` (routing by task layer), `review-code`, and 4 agents.
- **Decisions**: Fastify 5 + Zod type provider (reuses the web app's Zod for one shared contract
  in `shared/`); SQLite via `better-sqlite3` (durable, zero-ops; the prebuilt binary was verified
  to install without Xcode CLT); npm workspace `server/`; Vite proxy `/api` → :3001; an injected
  `Clock` with `APP_TODAY` so the date rules (BR-01/02) are deterministic (NFR-10).
- **Validation**: Built and tested in a throwaway copy first, then applied to the repo. Root
  `npm run validate` passed (web 16 tests, API 17 tests at 98.8% statements); web and Storybook
  builds passed; the real `npm run dev` smoke test passed (health directly and through the proxy,
  404 error shape, Swagger 200, SQLite file created).
- **Human decision**: Modified.
- **Corrections**:
  - Fastify 5 types the error handler's `error` as `unknown`, so it is now narrowed safely.
  - `npm install -w server` did not record deps before the workspace was installed, and the
    result left a broken vitest; fixed with a clean install (documented in the skill).
  - Added a test for file-DB reopen, the mechanism behind AC-007.3 (persistence across restart).
  - My first smoke test treated the proxy's 500 during API startup as "ready"; the skill now
    waits for HTTP 200.
  - Rejected `node:sqlite`, which is still experimental on Node 24.2.
