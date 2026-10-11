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

### 2026-10-07 · dealership dropdown (T-017 + T-033 pulled forward)

- **Trigger**: The stakeholder asked for a dropdown to select the dealership instead of changing
  the URL. This is US-008 / T-033, planned for Phase 5. I pulled it forward together with its
  dependency T-017 (form primitives, which Phase 2 needs anyway) and recorded that in the TRD.
- **Direction given**: Push navigation with filters reset (TA-10). The URL stays the only place
  the selection lives (AC-008.3). No previous-dealership rows may show (BR-04). Keyboard focus
  must stay on the select. Labels in EN and VI.
- **AI output**: `react-frontend-developer` built Field, TextInput, Select, Checkbox, and
  DealershipSelector, and refactored LanguageSwitcher onto Field/Select. It added an opt-out from
  the heading focus for selector navigation (`keepFocus` history state, validated with Zod).
- **Validation (mine)**:
  - `npm run validate` passed: web 229 tests, API 107.
  - Real Chrome via puppeteer-core against the real API:
    - The dropdown lists 4 dealerships A-Z.
    - Leeds goes to `/dealerships/2` (page param reset), with Leeds rows only ("1-25 of 220")
      and focus kept on the select.
    - York shows the empty state.
    - Back twice restores Birmingham `?page=2` with focus on the h1, and a reload keeps the
      selection.
  - axe-core 4.14 (WCAG 2.0 A/AA + 2.1 AA) on the live page reported 0 violations in English and
    in Vietnamese. This closes the "a11y not checked in a browser" gap the agent reported.
- **Human decision**: Accepted. The added focus mechanism is justified by the keyboard
  requirement, and the extra `src/lib` helpers keep component files exporting only components.

### 2026-10-07 · kept the scaffold UI store (user decision)

- **Trigger**: The user asked why `useUiStore.isSidebarOpen` was never used.
- **Finding**: `src/stores/ui-store.ts` was example code from the `/init-react-app` scaffold. It
  demonstrated the Zustand pattern. Only `src/test/setup.ts` referenced it, and no PRD or TRD
  requirement needs a sidebar.
- **Options I gave**: Remove it as dead code (my recommendation), or keep it. Adding a sidebar
  was explicitly ruled out by the user.
- **Human decision**: Keep the store as-is. I briefly removed it, then restored it from `HEAD`
  when the user asked to keep it. No sidebar UI is added, so `isSidebarOpen` stays unused until a
  requirement needs it. It remains the reference Zustand example until T-037 adds the first
  feature store.

### 2026-10-07 · implement-trd phase 2 (filters, sort, facets: T-013..T-016, T-018..T-020)

- **Waves**: Wave 1 was the backend (`node-backend-developer`: contract, age-to-date-range
  translation, filtering, search, and sort, plus the facets endpoint). Wave 2 was the web
  (`react-frontend-developer`: URL-state hook, FilterBar, and age range with the no-match state).
  The web depends on the contract, so the waves ran in sequence.
- **Agent self-checks that caught bugs**:
  - The backend agent's real curl check showed facets sorted `["Tucson","i10"]` (SQLite
    ordering is case-sensitive), which led to `COLLATE NOCASE` and TA-27.
  - The web agent caught a race in its own count assertions and a wrong fixture age calculation
    by running its tests.
- **My verification**:
  - I read the dynamic-WHERE repository code: fixed fragments with named parameters, LIKE with
    ESCAPE, a bounded statement cache.
  - Flaky tests: 3 web tests timed out at 5 s in 2 of 7 full runs, both while other processes
    were running, and passed in 5 idle runs. They wait on several async steps, so I raised
    `testTimeout` to 15 s and documented why.
  - Real Chrome via puppeteer-core:
    - Ford gives 25 rows, and the model list is Ford-only.
    - Changing the make to Toyota clears `model=Focus`.
    - Aging only gives 5 rows.
    - Typing " stk-104 " sends exactly 1 request.
    - Min 100 / max 50 shows an inline error and the URL is unchanged.
    - Clear filters restores the rows and focuses the filters.
    - axe reports 0 violations in EN and VI, and there is no overflow at 768 px.
- **End-of-phase review**:
  - The code reviewer APPROVED, with 3 MINOR findings:
    - Clear filters leaves a stale range draft (affects AC-002.8).
    - Several live regions announce at once.
    - The perf `beforeAll` is fragile under load.
  - The test engineer found 0 IDs uncovered and could not make any test flake, including runs
    under 6 CPU hogs. Top gap: nothing guards the MSW mock against drifting from the API, because
    the filter logic exists in two copies.
- **Decision**: Fix all of it in one round, with two agents on disjoint files.
  - Backend agent: a shared scenario table (`shared/api/vehicles.cases.ts`) run against both the
    real API (`app.inject`) and the MSW mock, ASCII-only case folding in the mock to match
    SQLite, perf bulk insert, and the int-param helper merge.
  - Web agent: the stale range draft, a single live announcer, single URL canonicalisation,
    search-history semantics (TA-28), and the missing tests (URL sort, inclusive range bounds,
    Vietnamese interaction, single-filter reset).
- **Fix-round outcome (verified by me)**:
  - `npm run validate` passed: web 388 tests, API 211.
  - Real Chrome:
    - AC-002.8: entering 100/50, Apply (error), then Clear filters leaves both range inputs
      empty, no error, and no "No vehicles in stock" flash.
    - TA-28: typing "stk" then "stk-10", one Back returns to `?make=Ford`.
  - The parity table paid off immediately: 3 mock-only divergences (Unicode vs SQLite ASCII
    case folding) were fixed in the mock, with the server as the source of truth.
  - The web agent's new tests exposed a real bug: an empty placeholder briefly showed "No
    vehicles in stock" after Clear filters.
- **Accepted with a caveat**: `MatchCount` keeps polls silent by remounting the live region
  when the same query's text changes. That relies on common screen-reader behaviour, and
  VoiceOver may differ. Paging is no longer announced. Both are queued for T-038 with a real
  screen-reader check rather than taken as done.

### 2026-10-07 · implement-trd phase 3 (KPIs and aging section: T-021..T-024)

- **Waves**:
  - Wave 1 ran in parallel: the backend built the summary contract and endpoint, plus MSW
    support and summary parity scenarios; the web built the aging section, which only needs the
    existing list endpoint.
  - Wave 2 (web): KPI cards and the layout for AC-005.4.
- **My decisions during the phase**:
  - TA-29: "View all N aging vehicles" originally kept the other filters, so with Ford active the
    button said 19 but the list showed 3. I decided it replaces the filters with only
    `agingOnly=true`. The filter-bar checkbox still combines with other filters (AC-004.3).
  - Perf: the cold request flaked at 595 ms under parallel load. A first workaround (cold 1 s /
    warm 500 ms) was rejected by the reviewer as using up the whole NFR-02 budget. Final
    decision: run the perf file on its own, with cold < 750 ms and warm < 200 ms.
  - Test timing: 3 s `findBy` waits flaked as the suite grew to 438 tests. I briefly raised the
    limit to 5 s; the reviewer called it masking, and the tester measured 4-7x slowdowns under
    coverage plus contention. The fix round goes after the causes: capped workers, splitting a
    two-behaviour test, cheaper table queries, and route preloads built from the router. Then
    the limit goes back down.
- **My own mistakes caught in this phase**:
  - A `validate` run that I read as "no output" had actually stopped at the format check,
    because of my unformatted TRD table edit.
  - My TRD note claimed the age-clamp mutation was caught "on both sides". The tester showed the
    web-side row was tautological, so I corrected the note.
- **Verification (mine, real API, headless Chrome at 1280x800)**:
  - KPIs show 360 / 86 / 23.9% / 86 and match `/summary`; the bottom of the KPI cards is at
    y=239 (AC-005.4).
  - The aging section shows the 10 oldest; the filter bar is 2 rows.
  - York shows 0 / 0 / 0% / "-" and "No aging stock".
  - axe reports 0 violations.
- **End-of-phase review**: CHANGES REQUESTED. Both the code reviewer and the test engineer,
  working independently, found the same BR-15 bug: `Math.round(a / n * 1000) / 10` gives 50.2
  for 201/400 instead of 50.3. I confirmed it, and checked that the fix (multiply first) has 0
  mismatches against exact half-up rounding for every pair up to n = 10,000. The parity table
  could not catch it because both sides copied the TRD's formula, so the TRD (TA-21) was the
  root cause and was fixed there too.
- **Fix round**: two agents on disjoint files.
  - Backend: rounding on both sides, more parity rows (including .x5 and float-trap cases), a
    `serverOnly` flag for rows only the server can verify, and the isolated perf run.
  - Web: flakiness root causes, quiet stale hints for KPIs and aging, a non-live aging loading
    state, a single screen-reader loading text, and the test gaps.
- **Fix-round outcome (verified by me)**:
  - The web agent was interrupted by a session limit mid-task. I checked the working tree was
    consistent (typecheck and lint clean), then resumed the same agent with its context and told
    it to re-check which items were already done before continuing.
  - Backend mutation matrix: the server catches all 8 mutations; the web mock catches 6. The 2
    that need date logic or action history are flagged `serverOnly` instead of being claimed.
  - I mutation-checked the new TA-29 draft test myself (the agent had not). Removing the clear
    marker from `replaceFilters` makes it fail. Restored byte-identical.
  - `asyncUtilTimeout` is back at 3 s after the root-cause fixes (capped workers, split test,
    cheaper queries, router-derived preloads).
  - `npm run validate` passed twice: web 448 (+2 server-only rows skipped by design), API 258,
    isolated perf 7 (worst cold 74 ms against a 750 ms budget).
  - AC-005.4 screenshots committed to `docs/screenshots/` (EN and VI, real API, KPI bottom at
    y=239 of 800).

### 2026-10-08 · implement-trd phase 4, wave 1 web (T-029 Dialog)

- **AI output**: `Dialog` built on native `<dialog>` with `showModal()`.
  - It is a controlled component: Escape is handled through a preventable `cancel` event, with a
    native-`close` fallback.
  - On open, focus moves to the heading; on close it returns to the trigger, or stays on body if
    the trigger is gone.
  - A backdrop click closes it only when the press also started on the backdrop.
  - There is a body scroll lock and a minimal jsdom stub (jsdom 29 lacks `showModal`/`close`).
  - The agent mutation-checked its own tests. Removing `onCancel` initially failed nothing, so it
    added a controlled-case test that now catches it.
- **My mistake caught by the agent**: my brief described a centred dialog, but ADR-006 in the TRD
  says a right-side drawer at md+. The agent flagged the conflict instead of picking silently.
- **Human decision (mine)**: keep ADR-006. The drawer keeps the list in view while a manager
  reviews and logs an action, and suits a long history. The mistake was in my brief, so the ADR
  stays as written. The class change is part of wave 2.

### 2026-10-08 · implement-trd phase 4 (log and persist actions: T-025..T-032)

- **Scope**: The brief's core requirement 3, "log and persist a status or proposed action for
  each aging vehicle".
- **Waves**:
  - Wave 1 ran in parallel:
    - Backend: contract, `GET /vehicles/:id` with history, `POST /vehicles/:id/actions`, the
      restart persistence test, MSW handlers, and a 27-row `actions.cases.ts` parity table run
      against the real API and the mock.
    - Web: the native `<dialog>` component.
  - Wave 2 (web): the detail drawer and history, the log form, and the save mutation.
- **My verification of wave 1 (real API, file DB, real restart)**:
  - A POST to the 90-day STK-1045 returned 422 and stored 0 actions. A POST to the 91-day
    STK-1178 returned 201, with the note and name trimmed. A 501-char note returned 400.
  - After a process restart, the action was still the current action and `needsAttention` was
    false.
  - I read the service: it reuses the list's `getVehicle` for aging, and has no `await` between
    the check and the insert.
- **My verification of wave 2 (real Chrome via puppeteer-core, real API, file DB, restart)**:
  - Opening "No action" STK-1223 from the aging section showed a right-side drawer (left=704,
    576x800) with focus on the heading. axe found 0 violations with the drawer open.
  - An empty submit showed both field errors and moved focus to the first status radio.
  - Saving "Price Reduction Planned" with the note `<b>cut</b> by 5%`:
    - The history shows the note as literal text; no `<b>` element is rendered.
    - The aging-section row updated without a reload.
    - The summary's `needsAttentionCount` went from 46 to 45.
  - Escape returned focus to the trigger. A 90-day vehicle shows no form.
  - Vietnamese shows "Vui lòng nhập tên của bạn." and "Dự kiến giảm giá 07/10/2026 13:00".
  - After a dev-server restart on the same DB file, the action and its note were still there.
  - Screenshots are in `docs/screenshots/vehicle-drawer-*.png`.
- **Mistake of mine caught by an agent**: my wave-1 brief said "centred dialog", contradicting
  ADR-006 (drawer). The agent flagged it. I kept the ADR and fixed it in wave 2.
- **Agent self-checks**:
  - The backend mutation-checked its tests: treating 90 days as aging made 5 tests fail;
    removing the blank-note-to-null rule made 6 fail.
  - The Dialog agent added a controlled-case test after finding that removing `onCancel` broke
    nothing.
  - The web agent rewrote a racy double-submit test so it holds the POST open deterministically.
- **End-of-phase review**:
  - The code reviewer APPROVED with 0 BLOCKER/MAJOR findings and 6 MINOR ones:
    - the character counter used UTF-16 units, so 300 emoji showed "600 / 500" in red but saved;
    - Save is `disabled` while saving, so Chromium blurs it and keyboard focus is lost;
    - the dialog had no focus fallback when the trigger disappears (a row leaves a
      needs-attention view after logging);
    - the restart test skipped `seedIfEmpty`;
    - malformed JSON returned `FST_ERR_CTP_*` instead of `VALIDATION_ERROR`;
    - mock parity bypassed the MSW handler.
  - The test engineer found every ID covered, 4 of them only partially. AC-007.2 (another
    browser or session) was proven only "by design", and there was no web reload test for
    AC-007.1.
  - One full-suite timeout was traced to the Mac sleeping mid-run (power log). The tester also
    found that a timed-out test keeps running and can break the next test's form; the fix is to
    scope queries with `within(dialog)`.
- **Decision**: Fix all 6 MINOR findings, the partial ACs, and most NITs in one round. Two agents
  work on disjoint files:
  - Backend: restart with seeding, an explicit two-instance test for AC-007.2, the
    malformed-JSON mapping, parity through the MSW handler, extra parity rows, and BR-12
    hardening against zero-width names.
  - Web: code-point counter, focusable Save, focus fallback, split load-sensitive test, web
    reload test, Vietnamese submit/messages, and the remaining test gaps.
- **Fix-round outcome (verified by me)**:
  - Backend:
    - The restart test now runs the real startup steps, including seeding. The second start
      reports seeded = [] and all row counts match.
    - AC-007.2 is proven by two server instances on one DB file: a write through A is visible
      through B in the detail, the list and the summary.
    - Body-parse errors return 400 `VALIDATION_ERROR`.
    - The parity table grew from 27 to 46 rows and now runs through the real MSW handler.
    - TA-30 defines blank text, so zero-width names are rejected.
  - Web:
    - The character counter counts code points (300 emoji shows "300 / 500").
    - Save stays focusable via `aria-disabled`, and an error moves focus to the alert.
    - The Dialog has a `returnFocusFallback`, and the load-sensitive test is split and scoped.
    - New tests cover a web reload, a Vietnamese submit with a canonical body, and inputs kept
      on 422 and on network errors.
  - My own fix: the `VEHICLE_NOT_AGING` message hard-coded "90". It now interpolates
    `{{days}}` from `AGING_THRESHOLD_DAYS`. My edit first failed `format:check`, which I fixed.
  - The web agent's `validate` failed only with Vitest workers that would not start, while the
    machine's load average was about 45 (Safari WebContent at 100-170% CPU). My rerun passed
    (exit 0): web 615, API 369, perf 7. Load reached 170 by the end of the run.
  - Real Chrome focus check:
    - Enter on Save keeps focus on Save while saving and after saving.
    - With `?needsAttention=true`, the logged row leaves the list. Escape then sends focus to
      `#inventory-list` "Vehicle list", not body.

### 2026-10-08 · implement-trd phase 5 (Should stories: T-034..T-037)

- **Setup**: One web agent did the tasks in sequence (T-035, T-036, T-034, T-037), because they
  share VehicleTable, FilterBar, DashboardPage and both locale files. Parallel agents editing
  `en.ts`/`vi.ts` at the same time risked clobbering each other.
- **Interruption**: The agent stalled with no output for 600 s under heavy machine load while
  writing the T-036 tests. I checked the working tree: T-035 was complete and T-036 was partial.
  I resumed the same agent with instructions to re-check what was done first, run targeted tests
  while iterating, and background long commands. After resuming it found and fixed a real bug in
  its own half-written work: Back/Forward re-announced the sort.
- **AI output**:
  - 5th KPI "Needs attention", a text label on rows and aging items, and a "Needs attention
    only" filter.
  - Sortable headers (`aria-sort`, default orders per TA-06, canonical URL) with exactly one
    announcement per sort.
  - RefreshControl: "Last updated" and an active-only, dealership-scoped refetch; vehicle detail
    now also polls every 60 s.
  - The first real Zustand store: "Logged by" persisted with Zod-validated rehydration, written
    only after a successful save.
  - `npm run validate` passed twice: web 674, API 369, perf 7.
- **My verification (real Chrome, real API, file DB)**:
  - At 1280 px, EN and VI: 5 KPIs on one row, bottom at y=239, Needs attention = 46.
  - Sorting by price gives `?sort=price&order=asc`, `aria-sort=ascending`, and £7,990 first; a
    second click gives `desc`.
  - The needs-attention filter gives "46 vehicles match", with all 25 rows labelled.
  - Refresh refetches summary, list and facets, and keeps the URL filter.
  - " Minh Nguyen " was saved, then prefilled as "Minh Nguyen" after a full reload, with
    validated localStorage.
  - axe found 0 violations in EN and VI, and there was no horizontal overflow at 768 px.
- **End-of-phase review**: The code reviewer returned CHANGES REQUESTED with 2 MAJOR findings.
  1. The sort was still re-announced after Back then Forward, and across a dealership round-trip.
     The agent had believed this was fixed, but its test only covered Back after a filter change.
  2. A pre-existing Phase 2 race in `useSearchDraft` could drop typed characters under load.
     The `validate` run showed "-10" typed after "stk" becoming "stk10". It is user-visible, and
     5 earlier reviews and every idle run had missed it.
  - The test engineer: the automatic 60 s poll was never exercised. NFR-05/TA-14 were "proven"
    only by option values, and `refetchIntervalInBackground: false` is the TanStack default, so
    that assertion proved nothing. AC-005.4 still has no automated viewport check (moved to T-042).
- **My orchestration mistake**: I ran the reviewer and the tester in parallel, and both ran
  coverage into the same `coverage/` directory. Each `validate` they ran then failed with
  "coverage directory already in use". From now on, parallel read-only agents get a private
  `--coverage.reportsDirectory`.
- **Decisions**:
  - TA-31: Refresh adds no new live region, and "Last updated" shows the **oldest**
    `dataUpdatedAt`, so it never overstates freshness.
  - TA-32: the "Logged by" name in localStorage is a documented PII note.
  - Everything else goes to a single web fix agent, with a failing test written first for each
    behaviour fix.

### 2026-10-08 · System Design Document and README (Phase 5/6 paused)

- **Human decision**: The stakeholder asked to put Phase 5 and 6 on hold and write the System
  Design Document and README first. I stopped the Phase 5 fix agent, which was waiting for its
  first `validate`, and left its changes uncommitted so it can be resumed with its context.
- **AI output**:
  - `/create-system-design` → `tech-lead-architect` wrote `docs/SYSTEM_DESIGN.md` (729 lines,
    10 sections). It includes all 16 PRD and 32 technical assumptions, architecture and sequence
    diagrams traced to the code, the real schema, ADR summaries, deliberate non-goals, the quality
    strategy, and a concrete AI-process section with 16 corrections and the orchestrator's own
    mistakes.
  - It listed 8 places where the TRD and the code disagree, with the code taking precedence.
- **README (written by me, in parallel)**: quick start, a reproducible demo with `APP_TODAY`, a
  walkthrough of the 3 brief requirements, the API table, structure, scripts, an honest status,
  and troubleshooting. I checked every concrete claim against a fresh seeded API: 360/86/23.9%/86,
  vehicle 224 = STK-1223 aging with no action (the curl POST returns 201), and in the 90-91 range
  91 is aging while 90 is not.
- **Validation of the SDD (mine)**:
  - A script confirmed that every A-01..A-16 and TA-01..TA-32 is present.
  - I read the architecture and sequence diagrams against the code, plus the AI-process section.
- **Corrections**:
  1. Row 11 claimed TA-29 was caught by a real-browser check; I caught it by reading the agent's
     reported decision.
  2. §10.6 said the 60 s poll was "observed in the browser"; it was never observed or tested by
     timer.
  3. It said the README was still open; the README was written in parallel.
  4. Following discrepancy 1, the TRD Phase 5 section now carries a status note: implemented,
     uncommitted, review fixes paused.

### 2026-10-08 · phase 5 fix round resumed and completed

- **Resume**: After the docs commit (`b676e27`), I resumed the stopped fix agent with its context
  and told it to re-check what was already done first. Every item had been finished before the
  pause. The only open issue was a test it had broken itself while editing a nearby test: a text
  replacement had changed the start URL of an unrelated test. It fixed that, then `validate`
  passed twice: web 699, API 369, perf 7.
- **Fixes, each with a test that failed first**:
  - The sort request is now one-shot and keyed by dealership.
  - `useSearchDraft` remembers its own pending commits, as a list, so two late commits don't
    clobber typing.
  - There is one canonical URL per sort.
  - "Last updated" shows the oldest data time (TA-31).
  - A fake-timer 60 s poll test and a hidden-tab test were added. The agent checked that both
    fail with a 30 s interval or with background polling switched on.
  - VI strings are asserted, and `removeItem` is tested.
  - The make/model sort test now checks the rendered order.
  - The Make sort button has a description hint ("sorts by make, then model").
- **My verification**:
  - `npm run validate` passed (exit 0): 699 / 369 / 7.
  - Real Chrome, real API:
    - Sort → Back → Forward left the sort status empty: no re-announcement.
    - Clicking the default "Days in stock" header gives a clean URL, and `?sort=age&order=desc`
      becomes "".
    - At **6x CPU throttling**, typing "stk", then "-10", then "4" in bursts around the 300 ms
      debounce kept "stk-104" in the box and the URL. This is the exact scenario that used to
      drop characters.
- **Docs**: the TRD Phase 5 status note and the SDD (§1.2, §2.2, §8.1, §8.6, §6.5, §9, §10.5,
  §10.6) were updated from "in progress" to the verified state.

### 2026-10-08 · implement-trd phase 6 (hardening: T-038..T-042)

- **Setup**: Two agents worked in parallel on disjoint files, each using a private coverage
  directory (the lesson from Phase 5).
  - Web (`src/`): T-038 a11y pass, T-039 states matrix, T-040 Storybook plays.
  - Playwright (`e2e/`, config, CI): T-042.
- **Playwright output**:
  - 11 tests against the real API and seed: their own ports, a pinned `APP_TODAY`, a fresh
    temporary DB, and the local Chrome channel. 3 runs, 0 flakes.
  - AC-005.4 is now automated: KPI bottom at y=239, all 5 cards in view, in EN and VI.
  - It found a real bug that jsdom could never show: two quick filter changes dropped the first
    one, because writers built on the last render's query while React Router had already pushed
    the URL.
- **My routing of that bug**: I sent it to the web agent already working in `src/` rather than
  starting a third agent on the same files. The fix (TA-33) builds on the router's current
  location, with red-first unit tests.
- **My verification**:
  1. I removed the E2E helper's "wait for the select" workaround, and E2E passed 11/11 twice.
  2. **I then mutation-checked my own guard: with the old code restored, it still passed.** On an
     idle machine, React re-renders between two Playwright actions. So I wrote
     `e2e/quick-filters.spec.ts`, which dispatches both changes in one browser task. It fails with
     the mutation (`?ageBucket=over-90`) and passes with the fix. I restored the file
     byte-identical and corrected the helper's comment so it no longer claims to be the guard.
  3. `npm run validate` passed: web 762, API 369, perf 7. E2E passed 12/12.
- **Web output**:
  - Regions and headings restructured: no nested region; the list is a section with an `h2`, and
    focus targets moved to that `h2`.
  - The paging range is announced once by `MatchCount`.
  - Contrast computed from the real oklch tokens: 4 pairs below AA fixed, guarded by
    `contrast.test.ts`.
  - A 7-region states matrix, plus Storybook plays for the feature states. The agent served the
    real Storybook and ran all 109 stories in Chrome: plays pass, 0 axe violations, after fixing 3
    story or app issues.
  - Bugs found along the way: facets raised an alert on a failed background refresh, and the
    drawer body was not keyboard-scrollable.
- **Decision**: I accepted React Router's `UNSAFE_DataRouterContext` (TA-33), with guards and a
  note to re-run them on upgrade, rather than a write-through ref workaround.
- **Docs**:
  - New `docs/ACCESSIBILITY.md` with decisions, the contrast table, automated evidence, and the
    17-step manual screen-reader checklist (not yet performed).
  - SDD §1.2, §5.5, §8, §9 and §10.4 updated; README status and the `npm run e2e` command added;
    T-038..T-042 ticked.
  - CSV export (Could) remains out, as future work.

### 2026-10-11 · aging list: long names on one line (stakeholder UI request)

- **Request**: In "Aging stock", long names such as "Land Rover Discovery Sport" should end with
  "…" instead of wrapping.
- **Change (mine, small enough not to delegate)**: The make/model cell in `AgingList.tsx` uses
  `truncate` (single line with an ellipsis) plus `title` with the full name for hover. The
  clipping is CSS only, so screen readers still read the full name. A test asserts the full text
  and the `title`.
- **Validation**:
  - The aging and page tests passed (82), as did lint and typecheck.
  - In real Chrome at 1280 px, EN and VI, all 3 long names were truncated to 1 line ("Land Rover
    Discovery …", "Land Rover Range Rov…"), and rows stayed 33-35 px tall.
- **Own mistake caught**: The verification screenshot showed "View all 91" and "401 days" instead
  of the pinned 86 and 400. The run's log showed `EADDRINUSE 127.0.0.1:3001`: a leftover API from
  an earlier run, without `APP_TODAY`, still held the port, and Vite proxied to it. My check
  scripts only waited for HTTP 200 from `/api/health`. From now on they also assert the expected
  `today` in the health response. A clean rerun gave `today: 2026-10-07` and 86 aging. The layout
  result was unaffected.

### 2026-10-11 · CSV export, client-side (PRD v0.4, T-043/T-044 redefined)

- **Trigger**: The user could not find a CSV export. It had never been built: US-013 was Could,
  and the docs listed it as "not done". I said so plainly and apologised that my earlier
  "remaining (optional)" wording could be misread.
- **Human decision**: The API returns data and the frontend builds the CSV, with no server CSV
  endpoint.
- **Spec first (mine)**:
  - PRD v0.4: AC-013.2..4 (busy state with no double export and no partial file on error;
    Vietnamese headings with untranslated data; formula-injection guard) and A-17.
  - TRD: ADR-010 (reuse the list API, all pages with `pageSize=100`, bounded concurrency,
    all-or-nothing) and TA-34 (columns, formats, file name, accepted mid-export drift).
  - T-043/T-044 were redefined from a server endpoint to client-side work.
- **AI output**:
  - An RFC 4180 writer (BOM, CRLF, a `'` prefix for text starting with `= + - @`, tab or CR,
    numbers never guarded).
  - A paged fetch: 4 at a time, kept in order, abortable, and rejected whole on any failure.
  - An ExportButton next to the match count: `aria-disabled` while exporting, focus kept, an
    alert on error, disabled with an explanation when there are 0 matches.
  - 3 E2E tests on the real API, including 360 rows sorted by price across page boundaries with
    no duplicates.
  - Web 824 tests, E2E 15/15. The agent also fixed the Tab-order test that the new button broke.
- **My verification (real Chrome, real API)**:
  - The new health guard caught a **second** stale dev server on :3001 (`today` was 2026-10-11
    instead of the pinned 2026-10-07). The guard did its job, so I re-ran clean.
  - The download was `inventory-birmingham-central-motors-2026-10-07.csv`, with the BOM, CRLF and
    exactly 5 Ford over-90 rows. Prices were `13395.00` with a GBP column; dates were ISO; vehicles
    with no action had empty logged-by and logged-at cells.
  - The VI export had Vietnamese headings, "Có" and "Dự kiến giảm giá", with the data unchanged.
  - The button sits on the same row as "5 xe khớp với bộ lọc", so the layout above the fold is
    unchanged.
- **Docs**:
  - TRD traceability and ticks updated; ACCESSIBILITY Tab order now includes Export CSV.
  - The SDD has ADR-010 and status "done"; the README status and the requirement 1 row were
    updated.
