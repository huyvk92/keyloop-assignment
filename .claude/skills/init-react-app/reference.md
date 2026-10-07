# init-react-app: reference files

These files were verified together on 2026-10-07 with Node 24, Vite 8, TypeScript 6, React 19.3,
react-router 8, Vitest 5, ESLint 9, Tailwind 4.3, and Storybook 10. Results:
`npm run validate` passes (15 tests, 98% coverage), and `npm run build` and `npm run build-storybook`
both pass.

Copy the files as given. If a newer package version breaks one, fix it minimally and record the
deviation in the report.

## Version notes (learned while verifying)

- `create-vite` now ships **oxlint** instead of ESLint. Run `npm uninstall oxlint`, delete
  `.oxlintrc.json`, and use the ESLint config below, because the plugins this repo needs (jsx-a11y,
  tanstack-query, testing-library, storybook) are ESLint plugins.
- Pin **`eslint@^9 @eslint/js@^9`**: `eslint-plugin-jsx-a11y` doesn't support ESLint 10 yet.
- The router package is `react-router` (v7+), **not** `react-router-dom`.
- `erasableSyntaxOnly` is on, so TypeScript parameter properties and `enum` don't compile.
- Storybook 10 uses **CSF Next** (`definePreview` / `preview.meta` / `meta.story`).
  `msw-storybook-addon` v3 is registered as an addon; its CSF3 `mswLoader` is deprecated.
- **lint-staged is pinned to `^16`**: v17 requires git ≥ 2.32, while v16 was verified to work with
  git 2.27 (older Macs where `brew upgrade git` needs new Xcode Command Line Tools).
- lint-staged's ESLint command needs **`--no-warn-ignored`**. Without it, staged files that ESLint
  ignores (such as `public/mockServiceWorker.js`) emit a warning, and `--max-warnings=0` blocks the commit.
- `react-refresh/only-export-components` forbids exporting helpers next to components, so helpers
  live in `lib/` (for example `lib/query-client.ts`).

## Extra dev dependencies (on top of SKILL.md step 2)

```bash
npm uninstall oxlint && rm -f .oxlintrc.json
npm install -D eslint@^9 @eslint/js@^9 typescript-eslint globals \
  eslint-plugin-react-hooks eslint-plugin-react-refresh
```

## package.json (merge these keys)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "coverage": "vitest run --coverage",
    "validate": "npm run typecheck && npm run lint && npm run format:check && npm run coverage",
    "prepare": "husky",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "imports": {
    "#*": ["./*", "./*.ts", "./*.tsx"]
  },
  "lint-staged": {
    "*.{ts,tsx,js}": ["eslint --fix --max-warnings=0 --no-warn-ignored", "prettier --write"],
    "*.{css,json,md,yml}": "prettier --write"
  }
}
```

`imports` enables `import preview from '#.storybook/preview'` in stories (CSF Next).

## Git hooks

```bash
npx husky init
printf 'npx lint-staged\n' > .husky/pre-commit
printf 'npx --no -- commitlint --edit "$1"\n' > .husky/commit-msg
```

## .gitignore (append)

```text
# Project
.env
.env.*.local
coverage
storybook-static
*.tsbuildinfo
*storybook.log
!.vscode/settings.json
```

## Config files

### `vite.config.ts`

```tsx
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/mocks/**',
        'src/test/**',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom/vitest"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Path alias (mirrors vite.config.ts) */
    "paths": { "@/*": ["./src/*"] },

    /* Type safety */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### `eslint.config.js`

```js
import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import storybook from 'eslint-plugin-storybook';
import testingLibrary from 'eslint-plugin-testing-library';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'storybook-static', 'public/mockServiceWorker.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../*'], message: 'Use the @/ alias instead of parent-relative imports.' },
            {
              group: ['@/features/*/*'],
              message: 'Import other features only through their index.ts (@/features/<name>).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react']],
  },
  {
    files: ['src/test/**', 'src/**/*.stories.tsx', '.storybook/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  ...storybook.configs['flat/recommended'],
  prettier,
]);
```

### `.prettierrc`

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/index.css"
}
```

### `.prettierignore`

```text
dist
coverage
storybook-static
public/mockServiceWorker.js
package-lock.json

# AI instructions (agents/skills) - verified reference code must stay byte-identical
.claude
```

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### `commitlint.config.js`

```js
export default { extends: ['@commitlint/config-conventional'] };
```

### `.env.example`

```text
# Public (VITE_*) variables are bundled into the browser - never put secrets here.
# Empty = same origin + /api
VITE_API_BASE_URL=
# true = intercept API calls with MSW handlers from src/mocks (no backend needed)
VITE_USE_MOCKS=true
```

### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer",
    "editorconfig.editorconfig"
  ]
}
```

### `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": { "*.css": "tailwindcss" }
}
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run validate
      - run: npm run build
      - run: npm run build-storybook -- --quiet
```

## Source files

### `src/index.css`

```css
@import 'tailwindcss';

/* Design tokens - extend here instead of using arbitrary values in JSX */
@theme {
  --color-brand-50: oklch(0.97 0.02 250);
  --color-brand-500: oklch(0.55 0.18 250);
  --color-brand-600: oklch(0.48 0.18 250);
  --color-brand-700: oklch(0.42 0.17 250);
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

### `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { env } from '@/lib/env';
import './index.css';

async function enableMocking() {
  if (!env.VITE_USE_MOCKS) return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
```

### `src/app/App.tsx`

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router';
import { ErrorFallback } from '@/app/ErrorFallback';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';

export function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  );
}
```

### `src/app/providers.tsx`

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/query-client';

type Props = { children: ReactNode };

export function Providers({ children }: Props) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools are excluded from production builds automatically */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### `src/app/router.tsx`

```tsx
import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from '@/app/Layout';
import { RouteError } from '@/app/RouteError';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

### `src/app/Layout.tsx`

```tsx
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900',
  );

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-sm text-slate-500">
        © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
```

### `src/app/RouteError.tsx`

```tsx
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong while loading this page.';

  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">Oops</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Back to home
      </Link>
    </div>
  );
}
```

### `src/app/ErrorFallback.tsx`

```tsx
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/Button';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-slate-600">An unexpected error occurred. Please try again.</p>
      <Button className="mt-4" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}
```

### `src/pages/HomePage.tsx`

```tsx
import { useEffect } from 'react';

export function HomePage() {
  useEffect(() => {
    document.title = 'Home';
  }, []);

  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="text-3xl font-bold tracking-tight">
        Welcome
      </h1>
      <p className="mt-2 text-slate-600">Start building features in src/features.</p>
    </section>
  );
}
```

### `src/pages/NotFoundPage.tsx`

```tsx
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="text-center">
      <h1 id="not-found-title" className="text-2xl font-semibold">
        Page not found
      </h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Back to home
      </Link>
    </section>
  );
}
```

### `src/components/Button.tsx`

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
} satisfies Record<Variant, string>;

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
} satisfies Record<Size, string>;

type Props = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
```

### `src/stores/ui-store.ts`

```tsx
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type UiState = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
};

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      isSidebarOpen: false,
      toggleSidebar: () =>
        set((s) => ({ isSidebarOpen: !s.isSidebarOpen }), undefined, 'ui/toggleSidebar'),
      closeSidebar: () => set({ isSidebarOpen: false }, undefined, 'ui/closeSidebar'),
    }),
    { name: 'ui-store', enabled: import.meta.env.DEV },
  ),
);
```

### `src/lib/cn.ts`

```tsx
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional Tailwind classes; later classes win on conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### `src/lib/env.ts`

```tsx
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(''),
  VITE_USE_MOCKS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/** Validated, typed environment. Fails fast at startup if misconfigured. */
export const env = envSchema.parse(import.meta.env);
```

### `src/lib/http.ts`

```tsx
import type { ZodType } from 'zod';
import { env } from '@/lib/env';

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** Absolute API URL. Empty VITE_API_BASE_URL = same origin + /api (works in browser and jsdom). */
export function apiUrl(path: string): string {
  const base = env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Fetch JSON and validate it with a Zod schema. Throws HttpError on non-2xx responses. */
export async function fetchJson<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...init, headers });
  const body: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`, body);
  }
  return schema.parse(body);
}
```

### `src/lib/query-client.ts`

```tsx
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
}
```

### `src/mocks/handlers.ts`

```tsx
import type { RequestHandler } from 'msw';

/**
 * Default API mocks shared by dev (VITE_USE_MOCKS), tests and Storybook.
 * Build URLs with apiUrl() from '@/lib/http'. Override per test with server.use(...).
 */
export const handlers: RequestHandler[] = [];
```

### `src/mocks/browser.ts`

```tsx
import { setupWorker } from 'msw/browser';
import { handlers } from '@/mocks/handlers';

export const worker = setupWorker(...handlers);
```

### `src/mocks/server.ts`

```tsx
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';

export const server = setupServer(...handlers);
```

### `src/test/setup.ts`

```tsx
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { useUiStore } from '@/stores/ui-store';

// Register every Zustand store here so each test starts from its initial state.
const stores = [useUiStore];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  stores.forEach((store) => store.setState(store.getInitialState(), true));
});

afterAll(() => server.close());
```

### `src/test/render.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  /** Initial URL, e.g. '/bookings?status=open' */
  route?: string;
  /** Route pattern the UI is mounted at, e.g. '/bookings/:id' */
  path?: string;
};

/** Render UI inside a fresh QueryClient and an in-memory data router. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*', ...options }: Options = {},
) {
  const queryClient = createTestQueryClient();
  const routes: RouteObject[] = [{ path, element: ui }];
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  return {
    user: userEvent.setup(),
    queryClient,
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
      options,
    ),
  };
}

/** Render the real app route tree (lazy routes included) at a given URL. */
export function renderRoutes(routes: RouteObject[], { route = '/' }: { route?: string } = {}) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return {
    user: userEvent.setup(),
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
```

## Tests

### `src/app/App.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { routes } from '@/app/router';
import { renderRoutes } from '@/test/render';

describe('App', () => {
  it('boots with providers and renders the home page', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown routes', async () => {
    renderRoutes(routes, { route: '/does-not-exist' });

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
```

### `src/app/errors.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/app/ErrorFallback';
import { RouteError } from '@/app/RouteError';
import { renderRoutes } from '@/test/render';

describe('ErrorFallback', () => {
  it('shows an alert and recovers when "Try again" is clicked', async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('boom');
      return <p>Recovered</p>;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});

describe('RouteError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows status details for route error responses', async () => {
    renderRoutes(
      [
        {
          path: '/',
          errorElement: <RouteError />,
          loader: () => {
            throw new Response(null, { status: 403, statusText: 'Forbidden' });
          },
          element: <p>never</p>,
        },
      ],
      { route: '/' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('403 Forbidden');
  });

  it('shows a generic message for unexpected errors', async () => {
    function Broken(): never {
      throw new Error('boom');
    }
    renderRoutes([{ path: '/', errorElement: <RouteError />, element: <Broken /> }]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong while loading this page.',
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
```

### `src/components/Button.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and marked busy while loading', () => {
    render(<Button isLoading>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('defaults to type="button" so it never submits forms accidentally', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
```

### `src/stores/ui-store.test.ts`

```tsx
import { useUiStore } from '@/stores/ui-store';

describe('useUiStore', () => {
  it('toggles the sidebar', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(true);

    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it('closes the sidebar', () => {
    useUiStore.setState({ isSidebarOpen: true });
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it('starts from the initial state in every test (reset in setup.ts)', () => {
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });
});
```

### `src/lib/http.test.ts`

```tsx
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { apiUrl, fetchJson, type HttpError } from '@/lib/http';
import { server } from '@/mocks/server';

const ItemSchema = z.object({ id: z.string(), name: z.string() });

describe('fetchJson', () => {
  it('returns parsed data for a valid response', async () => {
    server.use(http.get(apiUrl('/items/1'), () => HttpResponse.json({ id: '1', name: 'A' })));

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).resolves.toEqual({
      id: '1',
      name: 'A',
    });
  });

  it('throws HttpError with the status for non-2xx responses', async () => {
    server.use(
      http.get(apiUrl('/items/1'), () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    } satisfies Partial<HttpError>);
  });

  it('rejects when the response does not match the schema', async () => {
    server.use(http.get(apiUrl('/items/1'), () => HttpResponse.json({ id: 1 })));

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).rejects.toThrow();
  });

  it('sends JSON content type when a body is provided', async () => {
    let contentType: string | null = null;
    server.use(
      http.post(apiUrl('/items'), ({ request }) => {
        contentType = request.headers.get('Content-Type');
        return HttpResponse.json({ id: '2', name: 'B' });
      }),
    );

    await fetchJson(apiUrl('/items'), ItemSchema, {
      method: 'POST',
      body: JSON.stringify({ name: 'B' }),
    });

    expect(contentType).toBe('application/json');
  });
});
```

