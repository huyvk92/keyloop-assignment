---
name: setup-storybook
description: Install and configure Storybook 10 (React + Vite, CSF Next) with docs, a11y and MSW addons, wired to the app's Tailwind styles, TanStack Query and router providers, and shared MSW handlers. Use when Storybook is missing from the React app (called by /init-react-app) or its config needs repair.
argument-hint: (no arguments)
disable-model-invocation: true
---

# Setup Storybook

Exact file contents are in [reference.md](reference.md). Copy them as given.

## Preconditions

- `package.json` exists with Vite + React, and `public/mockServiceWorker.js` exists
  (`npx msw init public --save`).
- The `@/` alias is configured in `vite.config.ts` (Storybook reuses the app's Vite config, so
  the alias and the Tailwind plugin apply automatically).

## Steps

1. Initialize without launching the dev server:
   ```bash
   npx --yes storybook@latest init --yes --no-dev --type react --builder vite \
     --features docs a11y --disable-telemetry
   ```
   If the flags were rejected, check `npx storybook@latest init --help` and adapt.
   Don't enable the `test` feature (Vitest browser mode + Playwright) unless the TRD asks for it.
2. Remove the generated demo: `rm -rf src/stories`.
3. `npm install -D msw-storybook-addon`
4. Write `.storybook/main.ts` and `.storybook/preview.tsx` from reference.md. Delete the
   generated `.storybook/preview.ts` if it still exists.
5. Add `"imports": { "#*": ["./*", "./*.ts", "./*.tsx"] }` to `package.json` so stories can
   `import preview from '#.storybook/preview'`.
6. ESLint: `init` appends `...storybook.configs['flat/recommended']`. Make sure it comes **before**
   `prettier`, and that `.storybook/**` and `src/**/*.stories.tsx` turn off
   `react-refresh/only-export-components` (see the init-react-app reference for the full config).
7. Add the first story, `src/components/Button.stories.tsx`, from reference.md.

## What preview.tsx provides to every story

- `@/index.css`, so Tailwind styles and tokens render
- A fresh `QueryClient` (no retries) and a `MemoryRouter` per story
- An MSW worker started with the shared `src/mocks/handlers`. Override per story with:
  ```tsx
  export const Error = meta.story({
    beforeEach({ msw }) {
      msw.use(http.get(apiUrl('/bookings'), () => HttpResponse.json({}, { status: 500 })));
    },
  });
  ```
- `tags: ['autodocs']` and `a11y: { test: 'error' }`

## Verify

```bash
npm run lint && npm run typecheck
npm run build-storybook -- --quiet
grep -o '"id":"components-button--[a-z-]*"' storybook-static/index.json   # stories indexed
```

Report results. Interactive checks (`npm run storybook` at http://localhost:6006, a11y panel shows
0 violations) need a human, so list them as manual steps.
