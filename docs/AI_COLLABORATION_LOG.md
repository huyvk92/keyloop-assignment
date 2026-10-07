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

### 2026-10-07 · create-trd

- **Goal**: Turn PRD v0.1 into a TRD covering the web app, the API, the shared contract, and the DB schema.
- **Agent/skill**: `/create-trd` → `tech-lead-architect` subagent (preloaded with both best-practice skills).
- **Direction given**: Server-side computation of age, aging, KPIs, filtering, and paging
  (NFR-02); age by dealership-local calendar dates translated into `stock_in_date` ranges;
  append-only actions with the latest row as the current action; a suggested endpoint list; a
  shared Zod contract also used for URL state; a deterministic seed with exact 90/91-day
  boundaries; and phase 1 as a runnable vertical slice.
- **AI output**: `docs/TRD.md` with 8 ADRs, 23 technical assumptions, 6 endpoints, a SQLite
  schema with CHECKs, indexes, and append-only triggers, and 44 tasks (41 core + 3 optional)
  in 6 phases, tagged by layer (shared 4, api 13, web 23, full 4). The architect deviated from
  my direction in three places, each justified: dealership in the URL path (ADR-008), a fourth
  dealership with 0 vehicles for the empty states, and an aging section capped at 10 with
  "View all".
- **Validation**:
  - A script parsed all 44 tasks: every one has a valid layer; there are no unknown or forward
    dependencies and no cycles; web tasks that call endpoints all depend on the API task.
  - All 55 PRD ACs (42 Must) and all 18 BRs are referenced in the TRD.
  - Manual review of the contract, endpoints, and SQL: the aging cutoff is `<= today-91`; the
    VIN in AC-002.6 has 17 characters; a blank `loggedBy` is a 400 (BR-12/BR-18).
- **Human decision**: Modified.
- **Corrections**:
  1. The quality gate in §10 was outdated (it omitted format and coverage), so it now says
     `npm run validate`, plus the builds at the end of each phase.
  2. The Mermaid dependency graph omitted dependencies, so it is now labelled as simplified,
     with `depends-on` as the authoritative source.
  3. The architect found two contradictions inside the PRD. I fixed them in the PRD itself
     (v0.2) instead of leaving them only as TAs: A-14 vs NFR-05 (refresh every 60 s) and BR-06
     "make(s)" (single selection).
  4. The TRD template still said React 18, so it now says 19.

### 2026-10-07 · implement-trd phase 1 (T-001..T-012)

- **Goal**: Deliver the thin vertical slice: shared contract, schema, seed, and dealerships and
  vehicles APIs, plus the web list with age, the "Aging" label, and pagination.
- **Agent/skill**: `/implement-trd` (me as orchestrator). `node-backend-developer` did
  T-001..T-006. `react-frontend-developer` did T-007 and T-009 in parallel, then T-008, T-010, and
  T-011. Each agent ran only the tests for its own area while the other was working; I ran the
  full gate after each wave.
- **My verification per wave**:
  - Ran `npm run validate`.
  - Read the date maths (UTC epoch days, so DST-safe) and the repository SQL (parameters,
    whitelisted ORDER BY, latest-action subquery).
  - Called the real API and swept all 730 seeded vehicles: 90 days is never aging and 91 always
    is, in every dealership; lists are sorted oldest first; York has 0 vehicles.
- **T-012 slice check (real app)**: `rm -rf server/data && APP_TODAY=2026-10-07 npm run dev`,
  rendered in headless Chrome at 1280x800 (DOM dump + screenshot):
  - `/` redirects to Birmingham, with 25 rows and "Showing 1-25 of 360, Page 1 of 15".
  - The oldest vehicle (400 days) is labelled Aging, and action times show in London time.
  - After a restart the data is identical (`seeded: []`), so it was not reseeded.
  - Swagger lists the 3 endpoints.
- **Corrections I made**:
  - Error copy: 5xx is no longer described as "couldn't reach the server", and the
    VEHICLE_NOT_AGING text now explains the 90-day rule.
  - Chrome printed "Sept" while Node printed "Sep", which only a real browser showed. The month
    names are now a fixed table with a test.
  - "Aging" and "Current action" were cut off at 1280 px. I reordered the columns so they come
    first.
- **End-of-phase review** (`code-reviewer` + `test-engineer`, run in parallel and read-only):
  - The verdict was CHANGES REQUESTED, with no blockers. I re-checked the code for each MAJOR:
    1. Switching dealership briefly showed the previous dealership's rows (`keepPreviousData`
       was not scoped by dealership; BR-04).
    2. The seeder logged actions on vehicles that were exactly 90 days old (`age - 90`; BR-09).
    3. The seed test lacked the assertion that would have caught (2).
    4. I had ticked T-012 before logging it, which this entry fixes.
  - The tester reproduced a flaky lazy-route test under CPU load. It also found the DB status
    CHECK duplicating `ACTION_STATUSES` with no drift test.
  - Two report items were explained, not acted on. "93 tests instead of 92" was the reviewer's
    temporary probe test running at the same time. "Tasks not ticked" was a stale read.
- **Decision**: Fix all MAJORs and most MINOR and NIT items before committing. The backend agent
  and the web agent fix them in parallel, on disjoint files. The text-ordered stock-number
  tie-break is recorded as TA-24 instead of changed. MSW keeping the last value of a duplicate
  query key is accepted as a known gap.
- **Fix-round outcome (verified by me)**:
  - `npm run validate` passed: web 152 tests (99.6% statements), API 107 tests (98.9%). The
    web build and the Storybook build passed.
  - After reseeding, 122 actions exist. Only STK-1302, the intentional A-15 vehicle at 45 days,
    was logged while not aging. Every `logged_at` has milliseconds.
  - Headless Chrome against the real API: Birmingham shows 1-25 of 360 with no "Sept"; York
    shows the "No vehicles in stock" empty state.
  - Each new behavioural test failed before its fix. Tests for behaviour that was already
    correct were kept as regression guards.
  - Accepted deviations:
    - Leeds history share 0.4 → 0.5. The fix shifted the PRNG sequence and landed exactly on
      the realism test's threshold; the data was adjusted, not the test.
    - STK-1042 is priced at £10,990, not £25,990, which is more realistic for a 2018 Focus.
      AC-001.7 keeps its own fixture.

### 2026-10-07 · requirement change: English / Vietnamese UI (PRD v0.3, T-045..T-047)

- **Trigger**: The stakeholder asked for Vietnamese and English. This contradicted PRD A-13
  ("English UI") and the out-of-scope list, so I treated it as a requirement change rather than a
  code tweak.
- **Human decisions**: The user chose to commit the verified phase 1 web work first, so i18n
  has its own reviewable commit, and to always default to English.
- **Spec updates (by me)**:
  - PRD v0.3: US-015 (Must, 6 ACs), BR-19 (language is presentation only; data and statuses
    stay canonical), A-16 (English default, remembered per browser), and updated A-13, NFR-08,
    and out-of-scope.
  - TRD: ADR-009 (i18next + react-i18next, typed keys, no detector; versions checked against
    React 19 / TS 6 before choosing), TA-25 and TA-26 (formats verified with `Intl` vi-VN first),
    and Phase 1b T-045..T-047.
  - The `react-best-practices` skill got an i18n section, and the reviewer checklist got a
    hard-coded-string check, so later tasks follow the rule automatically.
- **AI output**: `react-frontend-developer` built the i18n foundation, translated the UI, and
  added the language switcher. It has 69/69 keys with a parity test; typed keys make a bad key
  fail `tsc`; English output is byte-identical (the original tests pass unchanged).
- **Validation**:
  - `npm run validate` passed (web 192 tests, API 107) and the build passed.
  - Real Chrome driven by `puppeteer-core`, installed in the scratchpad only and not in the
    repo, against the real API:
    - A first visit with a vi-VN browser shows English (AC-015.1).
    - Selecting "Tiếng Việt" translates the page in place, with the URL `?page=2`, focus, and
      data unchanged (AC-015.2, AC-015.5).
    - Vietnamese formats show as "21/09/2026 09:30" and "11.290 £" (AC-015.4).
    - The language survives a reload (AC-015.3).
    - The select has a label and per-option `lang` (AC-015.6).
- **Human decision**: Modified.
- **Corrections (my Vietnamese copy review)**: "Khuyến mãi tiếp thị" (awkward and redundant)
  became "Chạy khuyến mãi"; "Mã kho" (reads as "warehouse code") became "Mã tồn kho".
- **Open**: The copy is reviewed by me, not by a native-speaker product owner. The bundle grew
  to 130 kB gzip for the main chunk, and the ADR's 10-15 kB estimate was not measured separately.
