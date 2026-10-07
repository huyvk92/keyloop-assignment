---
name: react-best-practices
description: React + TypeScript best practices and approved libraries for this repo - structure, components, hooks, data fetching (TanStack Query), state (Zustand/URL/local), forms (React Hook Form + Zod), routing, Tailwind styling, accessibility, error handling, performance, security, testing and Storybook. Use whenever writing, reviewing, or planning React code in this repository.
---

# React Best Practices

These are the rules for all React code in this repo. If a rule has to be broken, the TRD needs an
ADR that explains why.

## 1. Approved libraries

| Concern | Library | Notes |
| ------- | ------- | ----- |
| Build | Vite + `@vitejs/plugin-react` | `@/` alias points to `src/` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), `clsx` + `tailwind-merge` via `cn()` | Tokens in `@theme` in `src/index.css` |
| Routing | `react-router` (v7+, data router; not `react-router-dom`) | Lazy routes, `errorElement` |
| Server state | `@tanstack/react-query` (+ devtools) | Never copy into Zustand |
| Client state | `zustand` | Shared client state only |
| Forms | `react-hook-form` + `@hookform/resolvers` + `zod` | One Zod schema per form |
| Validation | `zod` | All external data: API, env, URL params, storage |
| Errors | `react-error-boundary` | Root + route level |
| i18n | `i18next` + `react-i18next` | EN (default) + VI, typed keys, see §17 |
| Unit/integration tests | `vitest`, `@testing-library/react`, `user-event`, `jest-dom`, `msw` | |
| Component docs | Storybook 10 (`@storybook/react-vite`, CSF Next) + addon-docs + addon-a11y + `msw-storybook-addon` | |
| E2E (optional) | `@playwright/test` | Only if the TRD requires it |
| Quality | ESLint 9 (typescript-eslint, react-hooks, react-refresh, jsx-a11y, tanstack-query, testing-library, storybook), Prettier, husky, lint-staged, commitlint | ESLint 10 is blocked by jsx-a11y |

**Optional, add only through a TRD task:** `lucide-react` (icons), `date-fns` (dates),
`sonner` (toasts), `@tanstack/react-virtual` (long lists). Anything else needs an ADR.
Before importing a package, confirm it exists in `package.json`; never assume it does.

## 2. Project structure

```
src/
  app/          # App, providers, router, Layout, RouteError
  pages/        # thin route components: compose features, no business logic
  features/<f>/ # components/ hooks/ api/ store.ts types.ts index.ts (public API)
  components/   # shared, presentational UI (Button, Input, Card...) + stories
  stores/       # app-wide Zustand stores
  lib/          # cn, env, http, utils (pure, framework-free where possible)
  mocks/        # MSW handlers (shared by dev, tests, Storybook)
  test/         # setup, renderWithProviders
```

- Import other features only through their `index.ts`; never deep-import `features/x/components/...`.
- Use the `@/` alias to leave a folder. Inside a feature, one `../` to a sibling folder
  (`components` → `../api`, `../hooks`) is allowed; `../../` is not (ESLint enforces this).
- Shared components in `src/components/` don't know about features or fetch data.

## 3. Components

- Function components with named exports. Type props with `type Props = { ... }`.
- One component per file; the file name matches the component (`BookingCard.tsx`). Component
  files export only components (react-refresh rule), so helpers go in `lib/` or `hooks/`.
- Keep components under ~150 lines. Move logic into custom hooks and split presentation from
  data (a container hook plus a presentational component).
- Derive values during render; don't mirror props or other state into `useState`.
- Use stable, unique `key`s; never use the array index for lists that can change.
- Prefer composition (`children`, slots) over boolean-prop explosions. Model variants with a
  typed map: `const variants = { primary: '...', ghost: '...' } satisfies Record<Variant, string>`.
- React 19: `ref` is a regular prop, so don't add `forwardRef` to new code.

## 4. Hooks & effects

- Only use `useEffect` to sync with external systems (DOM APIs, subscriptions, timers). Don't use
  it for data fetching (TanStack Query does that), derived state, or event-driven logic (put that
  in the handler).
- Every effect cleans up (unsubscribe, clear timers, abort).
- Custom hooks start with `use`, return objects (not tuples) when they return more than 2 values,
  and are tested with `renderHook`.

## 5. Data fetching (TanStack Query)

Each feature's `api/` folder contains:

```ts
// api/booking.schemas.ts - Zod schemas, types via z.infer
// api/booking.api.ts     - fetchJson(apiUrl('/bookings'), BookingListSchema)
// api/booking.queries.ts - query key factory + queryOptions + hooks
export const bookingKeys = {
  all: ['bookings'] as const,
  list: (filters: BookingFilters) => [...bookingKeys.all, 'list', filters] as const,
  detail: (id: string) => [...bookingKeys.all, 'detail', id] as const,
};
export const bookingListOptions = (f: BookingFilters) =>
  queryOptions({ queryKey: bookingKeys.list(f), queryFn: () => getBookings(f) });
export const useBookings = (f: BookingFilters) => useQuery(bookingListOptions(f));
```

- Mutations invalidate or update the affected keys in `onSuccess`. Use optimistic updates only
  when the PRD requires instant feedback.
- Every query-driven UI renders all four states: **loading, error (with retry), empty, success**.
- Parse every response with Zod. A schema mismatch is an error, not something to ignore.

## 6. State: where does it live?

| State | Home |
| ----- | ---- |
| Data from the server | TanStack Query |
| Shareable/bookmarkable (filters, pagination, selected tab) | URL (`useSearchParams`), validated with Zod |
| Shared client-only state (UI, drafts, selections, wizard steps) | Zustand store |
| Form input | React Hook Form |
| Used by one component | `useState` / `useReducer` |

Zustand rules: small stores, each with a single responsibility. Read through selectors
(`useStore((s) => s.x)`), keep actions inside the store, and use `devtools` in dev. Use `persist`
only when a requirement calls for it. Register every store in the reset list in
`src/test/setup.ts`.

## 7. Forms

- `useForm({ resolver: zodResolver(schema), defaultValues })`. The schema is the single source of
  validation truth and can be reused by the API layer.
- Every input has a `<label>`. Errors are linked to their input with `aria-invalid` and
  `aria-describedby`, and show up as text, not only as color.
- Disable the submit button while submitting, show server errors, and don't lose user input when
  something fails.

## 8. Routing

- Route components are lazy-loaded (`lazy: () => import(...)`) for code splitting.
- Every top-level route has an `errorElement`, plus a catch-all 404 route.
- Pages set the document title and move focus to the `<h1>` on navigation.

## 9. Styling (Tailwind)

- Use utility classes in JSX and combine conditional classes with `cn()`. No inline `style`, CSS
  modules, or new CSS files unless an ADR justifies them.
- Put design tokens (colors, radius, fonts) in `@theme` and avoid scattered arbitrary values like
  `text-[#3a3a3a]`.
- Design mobile-first (`sm:`/`md:`/`lg:`), with visible focus styles (`focus-visible:ring-*`)
  and sufficient contrast.

## 10. Accessibility (WCAG 2.1 AA)

- Use semantic HTML first (`button`, `nav`, `main`, `ul`, `table`); add ARIA only to fill gaps.
- Everything works with the keyboard, focus order is logical, and dialogs trap and restore focus.
- Images have `alt`, icon-only buttons have `aria-label`, and status changes use `role="status"`
  or `aria-live`.
- `eslint-plugin-jsx-a11y` and Storybook's a11y addon must report 0 violations.

## 11. Error handling

- A root `ErrorBoundary` with a fallback UI and a reset button, plus a route `errorElement`.
- `HttpError` from `lib/http.ts` is mapped to user-friendly messages; raw errors are never shown.
- Log unexpected errors in one place (`lib/logger.ts` if needed), not with scattered `console.log`.

## 12. Performance

- Measure before optimizing (React DevTools Profiler). Only use `memo`/`useMemo`/`useCallback`
  when there's evidence or for referential stability that a dependency needs.
- Lazy-load routes and heavy components. Virtualize lists with more than ~100 rows.
- Debounce search inputs and keep the bundle lean by avoiding heavy dependencies for small tasks.

## 13. Security

- No `dangerouslySetInnerHTML` with untrusted data.
- `VITE_*` env vars ship to the browser, so they must never hold secrets. Env is validated in
  `lib/env.ts`.
- External links use `rel="noopener noreferrer"`. Validate and encode user input and URL params.

## 14. TypeScript

- Strict mode. No `any` (use `unknown` and narrow), no `enum` (use literal unions and `as const`),
  and no non-null `!` without a comment explaining why.
- Model UI states as discriminated unions. Use `satisfies` for config objects and
  `import type` for types.

## 15. Testing

- Test behavior, not implementation. Query priority: `getByRole` > `getByLabelText` >
  `getByText` > `getByTestId` (last resort).
- Use `userEvent` (from `renderWithProviders`), not `fireEvent`. Use `findBy*` for async UI.
- Mock HTTP with MSW only (`server.use(...)` for per-test overrides); never mock `fetch` or query
  hooks directly.
- Cover the loading, error, empty, and success states, plus validation errors for forms.
- No large snapshot tests.
- Coverage thresholds (`vite.config.ts`): 80% lines/functions/statements, 70% branches.

## 16. Storybook

- Every component in `src/components/` has a `*.stories.tsx`. Feature components get stories when
  they have several visual states.
- Use CSF Next: `import preview from '#.storybook/preview'`,
  `const meta = preview.meta({ component })`, and `export const X = meta.story({ args })`.
  Write one story per meaningful state (Default, variants, Disabled, Loading, Empty, Error).
  Autodocs and the a11y check apply globally.
- Override API mocks per story with `beforeEach({ msw }) { msw.use(...) }`. Interactions go in
  `play: async ({ canvas, userEvent, args }) => { ... }`, using `expect`/`fn` from `storybook/test`.

## 17. Internationalisation (EN/VI)

- No hard-coded user-visible strings in components. Use `const { t } = useTranslation()` and add
  every key to **both** `src/i18n/resources/en.ts` and `vi.ts`; the parity test fails otherwise.
  This covers aria-labels, `alt`, `document.title`, and empty, loading, and error text.
- Keys are grouped by feature (`inventory.table.header.days`). Interpolate values with
  `t('key', { count })` and never concatenate strings.
- Format dates, numbers, and money with the helpers bound to the current language
  (`useFormatters()`), not with `Intl` directly in components.
- Never translate data: make, model, notes, and names show as stored. Action statuses are canonical
  values; display them with `t(`actionStatus.${status}`)`.
- Tests render in English by default. For a Vietnamese assertion, call
  `i18n.changeLanguage('vi')` in the test; setup resets it.

## 18. Git

Use Conventional Commits (`feat(booking): add slot picker [T-004]`), enforced by commitlint.
lint-staged runs ESLint and Prettier on staged files.
