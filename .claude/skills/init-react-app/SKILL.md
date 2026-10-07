---
name: init-react-app
description: Scaffold a production-ready React + TypeScript repo - Vite, Tailwind CSS v4, React Router, TanStack Query, Zustand, React Hook Form, Zod, error boundaries, Vitest + RTL + MSW, Storybook, ESLint (a11y/query/testing plugins) + Prettier, husky + lint-staged + commitlint, CI workflow, path alias and env validation - following the react-best-practices skill. Use once at project start, before /implement-trd.
argument-hint: [target-dir, default "."]
disable-model-invocation: true
---

# Init React App

Target directory: `$ARGUMENTS` (default `.` = repository root).

Follow [react-best-practices](../react-best-practices/SKILL.md). Exact file contents are in
[reference.md](reference.md). Copy them as given and don't improvise configs.

## 0. Preconditions

- `node -v` ≥ 20. Write the major version to `.nvmrc`.
- git ≥ 2.27 works (lint-staged is pinned to v16; v17 would need git ≥ 2.32).
- If `package.json` already exists in the target, stop and ask before touching it.
- If the repo isn't under git, run `git init` now (husky needs it).

## 1. Scaffold

The repo root already contains `.claude/`, `docs/`, `CLAUDE.md`, so scaffold into a temp folder and
merge without overwriting existing files:

```bash
npx --yes create-vite@latest .scaffold-tmp --template react-ts --no-interactive
rsync -a --ignore-existing .scaffold-tmp/ <target>/
rm -rf .scaffold-tmp
npm uninstall oxlint && rm -f .oxlintrc.json   # template ships oxlint; this repo uses ESLint plugins
npm install
```

If the target is a new subfolder, scaffold straight into it instead.

## 2. Dependencies

```bash
npm install react-router @tanstack/react-query @tanstack/react-query-devtools zustand zod \
  react-hook-form @hookform/resolvers react-error-boundary clsx tailwind-merge

npm install -D eslint@^9 @eslint/js@^9 typescript-eslint globals \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  tailwindcss @tailwindcss/vite prettier prettier-plugin-tailwindcss \
  eslint-config-prettier eslint-plugin-jsx-a11y @tanstack/eslint-plugin-query \
  eslint-plugin-testing-library \
  vitest jsdom @vitest/coverage-v8 @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom msw \
  husky lint-staged@^16 @commitlint/cli @commitlint/config-conventional

npx msw init public --save
```

Use `react-router`, **not** `react-router-dom`. Keep ESLint on v9, because `eslint-plugin-jsx-a11y`
doesn't support v10 yet (see the version notes in reference.md).

## 3. Configuration files (contents in reference.md)

| File | Purpose |
| ---- | ------- |
| `vite.config.ts` | React + Tailwind plugins, `@/` alias, Vitest config, coverage thresholds |
| `tsconfig.app.json` | Add `paths` for `@/*` and the Vitest/jest-dom `types` (keep the template's other options) |
| `eslint.config.js` | typescript-eslint, react-hooks, react-refresh, jsx-a11y, tanstack-query, testing-library, prettier |
| `.prettierrc`, `.prettierignore` | Formatting + Tailwind class sorting |
| `.editorconfig`, `.nvmrc` | Editor and Node consistency |
| `.vscode/extensions.json`, `.vscode/settings.json` | Recommended extensions, format on save |
| `commitlint.config.js`, `.husky/pre-commit`, `.husky/commit-msg` | Git hooks |
| `.github/workflows/ci.yml` | CI quality gate |
| `.env.example`, `.gitignore` additions | Env documentation, ignore build artifacts |
| `package.json` | Scripts + `lint-staged` block |

Husky: run `npx husky init`, then overwrite `.husky/pre-commit` and create `.husky/commit-msg`
from the reference.

## 4. Source files (contents in reference.md)

Delete the Vite demo files (`src/App.tsx`, `src/App.css`, `src/assets/`, `public/icons.svg`)
and create:

```
src/
  index.css             # @import "tailwindcss"; + @theme tokens
  main.tsx              # optional MSW in dev, then render <App/>
  app/App.tsx           # ErrorBoundary > Providers > RouterProvider
  app/providers.tsx     # QueryClientProvider + devtools
  app/router.tsx        # data router, lazy routes, errorElement, 404
  app/Layout.tsx        # skip link, header/nav/main/footer landmarks, <Outlet/>
  app/RouteError.tsx    # route-level error UI
  app/ErrorFallback.tsx # root error-boundary fallback with retry
  pages/HomePage.tsx
  pages/NotFoundPage.tsx
  components/Button.tsx # reference shared component (variants, a11y, cn)
  components/Button.test.tsx
  stores/ui-store.ts    # example Zustand store
  stores/ui-store.test.ts
  features/.gitkeep
  lib/cn.ts
  lib/env.ts            # Zod-validated import.meta.env
  lib/http.ts           # apiUrl(), fetchJson(schema), HttpError
  lib/http.test.ts
  lib/query-client.ts   # createQueryClient() (kept out of providers.tsx for react-refresh)
  mocks/handlers.ts  mocks/browser.ts  mocks/server.ts
  test/setup.ts  test/render.tsx
  app/App.test.tsx      # boots <App/>, home page + 404 route
  app/errors.test.tsx   # ErrorFallback retry, RouteError (response + unexpected)
```

## 5. Storybook

Run the steps in [setup-storybook](../setup-storybook/SKILL.md), which also adds
`components/Button.stories.tsx`.

## 6. Verify (all must pass, fix and re-run until green)

```bash
npm run validate          # typecheck + lint + format:check + test --run --coverage
npm run build
npm run build-storybook -- --quiet
echo 'bad message' | npx commitlint            # must FAIL
echo 'chore: scaffold' | npx commitlint        # must pass
git add -A && npx lint-staged                  # must pass
```

Also check:
- `dist/assets/*.css` contains a utility class used in `Layout.tsx` (Tailwind is working)
- Running `npm run dev` with `VITE_USE_MOCKS=true` logs `[MSW] Mocking enabled` (check manually or
  report it as unverified)

## 7. Report

List the installed versions (`npm ls --depth=0`), the created structure, gate results, and any
deviation from reference.md and why. Suggest (but don't make) the initial commit:
`chore: scaffold react app [init-react-app]`. Log the step with `/log-ai-decision`.
Next: `/implement-trd phase-1`.
