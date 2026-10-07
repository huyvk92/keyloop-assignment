# init-node-api: reference files

Verified together on 2026-10-07 (Node 24.2, Fastify 5.12, fastify-type-provider-zod 7.0,
better-sqlite3 13.0 using its prebuilt binary, Zod 4.6, Vitest 5, TypeScript 6). Results:
- root `npm run validate` passes: web 16 tests, API 17 tests (98.8% statements)
- `npm run build` and `npm run build-storybook` pass
- `npm run dev` starts both processes; `/api/health` answers directly on :3001 and through the
  Vite proxy on :5173; `/api/docs` (Swagger) returns 200; Helmet headers are present
- the SQLite file is created at `server/data/app.db`; reopening keeps data (tested)

Copy the files as given. If a newer package version breaks one, fix it minimally and report the
deviation.

## Version notes (learned while verifying)

- After adding `"workspaces": ["server"]` to the root `package.json`, run a **root `npm install`
  first**. `npm install -w server <pkgs>` may not record the dependencies otherwise. If tools then
  fail with missing files (e.g. `vitest/dist/cli.js`), do a clean install:
  `rm -rf node_modules server/node_modules && npm install`.
- `better-sqlite3` is a native module. It installs from a prebuilt binary on common platforms;
  without one it needs build tools (Xcode CLT / build-essential). On failure, report it rather
  than switching databases silently. (`node:sqlite` still prints an ExperimentalWarning on Node 24.2.)
- Fastify 5 types the error handler's `error` as `unknown`, so narrow it (see `error-handler.ts`).
- `fastify-type-provider-zod` v7 needs `zod >= 4.1.5` and `@fastify/swagger >= 9.5.1`. Use
  `FastifyPluginAsyncZod<Options>` for typed route plugins.
- The server uses `module: preserve` + `moduleResolution: bundler`, so imports are extensionless
  like the web app, and `tsx` resolves the `@shared/*` paths from `server/tsconfig.json`.

## Install

```bash
# root package.json: add  "workspaces": ["server"]  then:
npm install
npm install -w server fastify fastify-type-provider-zod @fastify/swagger @fastify/swagger-ui \
  @fastify/cors @fastify/helmet better-sqlite3 zod
npm install -D -w server tsx @types/better-sqlite3 @types/node typescript vitest @vitest/coverage-v8
npm install -D concurrently
```

## Root package.json scripts (replace/add)

```json
{
  "dev": "concurrently -k -n web,api -c cyan,green \"npm:dev:web\" \"npm:dev:api\"",
  "dev:web": "vite",
  "dev:api": "npm run dev -w server",
  "start:api": "npm run start -w server",
  "seed:api": "npm run seed -w server",
  "typecheck": "tsc -b --noEmit && npm run typecheck -w server",
  "test": "vitest",
  "test:api": "npm run test -w server",
  "coverage": "vitest run --coverage",
  "coverage:api": "npm run coverage -w server",
  "validate": "npm run typecheck && npm run lint && npm run format:check && npm run coverage && npm run coverage:api"
}
```

## Root file changes

- `tsconfig.app.json`: `"paths": { "@/*": ["./src/*"], "@shared/*": ["./shared/*"] }` and
  `"include": ["src", "shared"]`
- `.env.example` / `.env`: `VITE_USE_MOCKS=false` (the real API is used in dev; MSW remains for
  tests and Storybook, and for frontend-only work with `true`)
- `.gitignore`: append `server/.env`, `server/data`, `server/coverage`

### `vite.config.ts`

```ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    // Forward API calls to the backend (server/) during development
    proxy: { '/api': 'http://127.0.0.1:3001' },
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
  globalIgnores([
    'dist',
    'coverage',
    'server/coverage',
    'storybook-static',
    'public/mockServiceWorker.js',
  ]),
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
    // API (Node): relative imports are idiomatic; never import web code
    files: ['server/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/*'], message: 'The API must not import web app code (src/).' }] },
      ],
    },
  },
  {
    // Shared API contract: only Zod schemas/types, no web or API code
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/*', '../*'], message: 'shared/ may only depend on zod.' }],
        },
      ],
    },
  },
  {
    files: ['src/test/**', 'src/**/*.stories.tsx', '.storybook/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  ...storybook.configs['flat/recommended'],
  prettier,
]);
```

### `src/lib/http.ts`

```ts
import { ApiErrorSchema } from '@shared/api/common';
import type { ZodType } from 'zod';
import { env } from '@/lib/env';

export class HttpError extends Error {
  readonly status: number;
  /** Machine-readable code from the API error body (e.g. VALIDATION_ERROR), if present. */
  readonly code: string | undefined;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.code = ApiErrorSchema.safeParse(body).data?.error.code;
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

## Shared contract

### `shared/api/common.ts`

```ts
import { z } from 'zod';

/**
 * API contract shared by the web app (src/) and the API (server/).
 * Only Zod schemas and inferred types live here - no runtime code that depends on either side.
 */

/** Every non-2xx API response has this shape. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('up'),
  /** The server's notion of "today" (YYYY-MM-DD); fixed when APP_TODAY is set. */
  today: z.iso.date(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

## Server files

### `server/package.json`

```json
{
  "name": "@keyloop/api",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=.env src/server.ts",
    "start": "tsx --env-file-if-exists=.env src/server.ts",
    "seed": "tsx --env-file-if-exists=.env src/db/seed-cli.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "@types/node": "^24.19.1",
    "@vitest/coverage-v8": "^5.0.3",
    "tsx": "^4.23.15",
    "typescript": "^6.0.3",
    "vitest": "^5.0.3"
  },
  "dependencies": {
    "@fastify/cors": "^11.3.0",
    "@fastify/helmet": "^13.1.1",
    "@fastify/swagger": "^9.9.1",
    "@fastify/swagger-ui": "^6.1.1",
    "better-sqlite3": "^13.0.3",
    "fastify": "^5.12.5",
    "fastify-type-provider-zod": "^7.0.0",
    "zod": "^4.6.5"
  }
}
```

### `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": ["node", "vitest/globals"],
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",

    /* Shared API contract (mirrors vitest.config.ts) */
    "paths": { "@shared/*": ["../shared/*"] },

    /* Type safety */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "test", "../shared", "vitest.config.ts"]
}
```

### `server/vitest.config.ts`

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/db/seed-cli.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
```

### `server/.env.example`

```text
# API server configuration (validated in src/config.ts)
HOST=127.0.0.1
PORT=3001
# SQLite file, relative to server/. Use :memory: for a throwaway database.
DATABASE_PATH=data/app.db
# Web app origin allowed by CORS (the Vite dev server proxies /api, so CORS only matters without it)
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
# Optional fixed "today" (YYYY-MM-DD) for deterministic demos of date-based rules
# APP_TODAY=2026-10-07
```

### `server/src/config.ts`

```ts
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().min(1).default('data/app.db'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_TODAY: z.iso.date().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Parse and validate environment variables. Throws at startup if misconfigured. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
```

### `server/src/lib/clock.ts`

```ts
/**
 * Source of the current time. Business rules must read time through a Clock (never `new Date()`
 * directly) so tests and demos can pin "today".
 */
export type Clock = { now: () => Date };

export const systemClock: Clock = { now: () => new Date() };

/** A clock frozen at noon UTC on the given date (YYYY-MM-DD). */
export function fixedClock(isoDate: string): Clock {
  const instant = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid date: ${isoDate}`);
  return { now: () => new Date(instant) };
}
```

### `server/src/lib/errors.ts`

```ts
/** Errors that map to a specific HTTP status and a stable, machine-readable code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

/** A valid request that breaks a business rule (e.g. BR-09: actions only for aging vehicles). */
export class BusinessRuleError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(422, code, message, details);
    this.name = 'BusinessRuleError';
  }
}
```

### `server/src/plugins/error-handler.ts`

```ts
import type { ApiError } from '@shared/api/common';
import type { FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors';

function errorBody(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function getNumber(value: unknown, key: string): number | undefined {
  const field = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return typeof field === 'number' ? field : undefined;
}

function getString(value: unknown, key: string): string | undefined {
  const field = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return typeof field === 'string' ? field : undefined;
}

/** Uniform error responses: every non-2xx body matches ApiErrorSchema. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(400)
        .send(errorBody('VALIDATION_ERROR', 'Request validation failed', error.validation));
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'Response did not match its schema');
      return reply.code(500).send(errorBody('INTERNAL_ERROR', 'An unexpected error occurred'));
    }

    const statusCode = getNumber(error, 'statusCode') ?? 500;
    if (statusCode < 500 && error instanceof Error) {
      const code = getString(error, 'code') ?? 'BAD_REQUEST';
      return reply.code(statusCode).send(errorBody(code, error.message));
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send(errorBody('INTERNAL_ERROR', 'An unexpected error occurred'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send(errorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );
}
```

### `server/src/db/connection.ts`

```ts
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

/** Open (and create if needed) the SQLite database. Use ':memory:' for tests. */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
```

### `server/src/db/migrate.ts`

```ts
import type { Db } from './connection';

export type Migration = { id: number; name: string; sql: string };

/**
 * Ordered schema migrations. Append new entries with the next id; never edit or reorder an
 * entry that has been applied anywhere - write a new migration instead.
 */
export const migrations: Migration[] = [];

/** Apply pending migrations, each in its own transaction. Returns the names applied. */
export function migrate(db: Db, list: Migration[] = migrations): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(db.prepare<[], number>('SELECT id FROM schema_migrations').pluck().all());
  const record = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
  );
  const pending = list.filter((m) => !applied.has(m.id)).sort((a, b) => a.id - b.id);

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.id, migration.name, new Date().toISOString());
    })();
  }
  return pending.map((m) => m.name);
}
```

### `server/src/db/seed.ts`

```ts
import type { Clock } from '../lib/clock';
import type { Db } from './connection';

export type Seeder = {
  name: string;
  /** True when this seeder's data already exists (seeding is skipped). */
  isSeeded: (db: Db) => boolean;
  run: (db: Db, clock: Clock) => void;
};

/** Sample-data seeders, run in order on startup when their data is missing. */
export const seeders: Seeder[] = [];

/** Run every seeder whose data is missing, each in a transaction. Returns the names run. */
export function seedIfEmpty(db: Db, clock: Clock, list: Seeder[] = seeders): string[] {
  const ran: string[] = [];
  for (const seeder of list) {
    if (seeder.isSeeded(db)) continue;
    db.transaction(() => seeder.run(db, clock))();
    ran.push(seeder.name);
  }
  return ran;
}
```

### `server/src/db/seed-cli.ts`

```ts
import { loadConfig } from '../config';
import { fixedClock, systemClock } from '../lib/clock';
import { openDatabase } from './connection';
import { migrate } from './migrate';
import { seedIfEmpty } from './seed';

const config = loadConfig();
const db = openDatabase(config.DATABASE_PATH);
const applied = migrate(db);
const seeded = seedIfEmpty(db, config.APP_TODAY ? fixedClock(config.APP_TODAY) : systemClock);
db.close();

console.warn(`Migrations applied: ${applied.join(', ') || 'none'}`);
console.warn(`Seeders run: ${seeded.join(', ') || 'none (data already present)'}`);
```

### `server/src/routes/health.ts`

```ts
import { HealthResponseSchema } from '@shared/api/common';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../db/connection';
import type { Clock } from '../lib/clock';

type Options = { db: Db; clock: Clock };

export const healthRoutes: FastifyPluginAsyncZod<Options> = async (app, { db, clock }) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness and database check',
        response: { 200: HealthResponseSchema },
      },
    },
    async () => {
      db.prepare('SELECT 1').get();
      return {
        status: 'ok' as const,
        database: 'up' as const,
        today: clock.now().toISOString().slice(0, 10),
      };
    },
  );
};
```

### `server/src/app.ts`

```ts
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import type { Db } from './db/connection';
import type { Clock } from './lib/clock';
import { registerErrorHandler } from './plugins/error-handler';
import { healthRoutes } from './routes/health';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Pick<Config, 'CORS_ORIGIN'>;
};

/**
 * Build the Fastify app with all dependencies injected (no globals), so tests can pass an
 * in-memory database and a fixed clock. Feature modules are registered under /api.
 */
export async function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(cors, { origin: deps.config.CORS_ORIGIN });
  await app.register(swagger, {
    openapi: { info: { title: 'Inventory API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs', staticCSP: true });

  await app.register(healthRoutes, { prefix: '/api', db: deps.db, clock: deps.clock });
  // Register feature modules here, e.g.:
  // await app.register(vehicleRoutes, { prefix: '/api', db: deps.db, clock: deps.clock });

  return app;
}
```

### `server/src/server.ts`

```ts
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/connection';
import { migrate } from './db/migrate';
import { seedIfEmpty } from './db/seed';
import { fixedClock, systemClock } from './lib/clock';

const config = loadConfig();
const clock = config.APP_TODAY ? fixedClock(config.APP_TODAY) : systemClock;

const db = openDatabase(config.DATABASE_PATH);
const applied = migrate(db);
const seeded = seedIfEmpty(db, clock);

const app = await buildApp({ db, clock, config }, { logger: { level: config.LOG_LEVEL } });
app.log.info({ applied, seeded, today: clock.now().toISOString().slice(0, 10) }, 'Database ready');

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
```

## Tests

### `server/test/helpers.ts`

```ts
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedIfEmpty, type Seeder } from '../src/db/seed';
import { fixedClock } from '../src/lib/clock';

type Options = {
  /** Pinned "today" (YYYY-MM-DD) for deterministic date rules. */
  today?: string;
  /** Seeders to run; defaults to none so each test controls its own data. */
  seeders?: Seeder[];
  /** Register extra routes before the app is ready (e.g. to exercise error handling). */
  setup?: (app: FastifyInstance) => void | Promise<void>;
};

/** A fully wired app on a fresh in-memory database. Call `close()` in afterEach. */
export async function createTestApp({ today = '2026-10-07', seeders = [], setup }: Options = {}) {
  const db = openDatabase(':memory:');
  migrate(db);
  const clock = fixedClock(today);
  seedIfEmpty(db, clock, seeders);

  const app = await buildApp(
    { db, clock, config: { CORS_ORIGIN: 'http://localhost:5173' } },
    { logger: false },
  );
  await setup?.(app);
  await app.ready();

  return {
    app,
    db,
    clock,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
```

### `server/src/config.test.ts`

```ts
import { loadConfig } from './config';
import { fixedClock } from './lib/clock';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3001,
      DATABASE_PATH: 'data/app.db',
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT and accepts a valid APP_TODAY', () => {
    expect(loadConfig({ PORT: '4000', APP_TODAY: '2026-10-07' })).toMatchObject({
      PORT: 4000,
      APP_TODAY: '2026-10-07',
    });
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow();
    expect(() => loadConfig({ APP_TODAY: '07/10/2026' })).toThrow();
  });
});

describe('fixedClock', () => {
  it('always returns the pinned date', () => {
    expect(fixedClock('2026-10-07').now().toISOString()).toBe('2026-10-07T12:00:00.000Z');
  });

  it('rejects an invalid date', () => {
    expect(() => fixedClock('not-a-date')).toThrow('Invalid date');
  });
});
```

### `server/src/db/connection.test.ts`

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './connection';

describe('openDatabase', () => {
  it('creates missing folders and keeps data across reopen (service restart)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-db-'));
    const path = join(dir, 'nested', 'app.db');
    try {
      const first = openDatabase(path);
      first.exec('CREATE TABLE notes (text TEXT)');
      first.prepare('INSERT INTO notes VALUES (?)').run('persisted');
      first.close();

      const second = openDatabase(path);
      expect(second.prepare('SELECT text FROM notes').pluck().all()).toEqual(['persisted']);
      expect(second.pragma('foreign_keys', { simple: true })).toBe(1);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

### `server/src/db/migrate.test.ts`

```ts
import { openDatabase } from './connection';
import { migrate, type Migration } from './migrate';

const createWidgets: Migration = {
  id: 1,
  name: '001_create_widgets',
  sql: 'CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
};

describe('migrate', () => {
  it('applies pending migrations once and records them', () => {
    const db = openDatabase(':memory:');

    expect(migrate(db, [createWidgets])).toEqual(['001_create_widgets']);
    expect(migrate(db, [createWidgets])).toEqual([]);
    db.prepare('INSERT INTO widgets (name) VALUES (?)').run('a');
    db.close();
  });

  it('rolls back a failing migration and leaves no record', () => {
    const db = openDatabase(':memory:');
    const broken: Migration = {
      id: 2,
      name: '002_broken',
      sql: 'CREATE TABLE gadgets (id INTEGER PRIMARY KEY); INSERT INTO missing VALUES (1);',
    };

    expect(() => migrate(db, [createWidgets, broken])).toThrow();
    const recorded = db.prepare('SELECT name FROM schema_migrations').pluck().all();
    expect(recorded).toEqual(['001_create_widgets']);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gadgets'").get(),
    ).toBeUndefined();
    db.close();
  });
});
```

### `server/src/db/seed.test.ts`

```ts
import { fixedClock } from '../lib/clock';
import { openDatabase } from './connection';
import { seedIfEmpty, type Seeder } from './seed';

const widgets: Seeder = {
  name: 'widgets',
  isSeeded: (db) => db.prepare<[], number>('SELECT COUNT(*) FROM widgets').pluck().get() !== 0,
  run: (db, clock) => {
    db.prepare('INSERT INTO widgets (created_on) VALUES (?)').run(
      clock.now().toISOString().slice(0, 10),
    );
  },
};

describe('seedIfEmpty', () => {
  it('runs seeders only when their data is missing, using the injected clock', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, created_on TEXT NOT NULL)');
    const clock = fixedClock('2026-10-07');

    expect(seedIfEmpty(db, clock, [widgets])).toEqual(['widgets']);
    expect(seedIfEmpty(db, clock, [widgets])).toEqual([]);
    expect(db.prepare('SELECT created_on FROM widgets').pluck().all()).toEqual(['2026-10-07']);
    db.close();
  });
});
```

### `server/src/plugins/error-handler.test.ts`

```ts
import { ApiErrorSchema } from '@shared/api/common';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createTestApp } from '../../test/helpers';
import { BusinessRuleError, NotFoundError } from '../lib/errors';

function registerTestRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    '/api/test/validate',
    { schema: { body: z.object({ note: z.string().max(5) }) } },
    async () => ({ ok: true }),
  );
  typed.get('/api/test/not-found', async () => {
    throw new NotFoundError('Vehicle not found');
  });
  typed.get('/api/test/rule', async () => {
    throw new BusinessRuleError(
      'VEHICLE_NOT_AGING',
      'Actions can only be logged for aging vehicles',
    );
  });
  typed.get('/api/test/crash', async () => {
    throw new Error('secret internal detail');
  });
  typed.get(
    '/api/test/bad-response',
    { schema: { response: { 200: z.object({ id: z.string() }) } } },
    async () => ({ id: 42 }) as unknown as { id: string },
  );
}

describe('error handler', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeEach(async () => {
    ctx = await createTestApp({ setup: registerTestRoutes });
  });
  afterEach(async () => {
    await ctx.close();
  });

  it('returns 400 VALIDATION_ERROR with details for invalid input', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/test/validate',
      payload: { note: 'too long' },
    });

    expect(response.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('maps AppError subclasses to their status and code', async () => {
    const notFound = await ctx.app.inject({ method: 'GET', url: '/api/test/not-found' });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });

    const rule = await ctx.app.inject({ method: 'GET', url: '/api/test/rule' });
    expect(rule.statusCode).toBe(422);
    expect(ApiErrorSchema.parse(rule.json()).error.code).toBe('VEHICLE_NOT_AGING');
  });

  it('hides internal details of unexpected errors', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/test/crash' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it('returns 500 when a response does not match its schema', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/test/bad-response' });

    expect(response.statusCode).toBe(500);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('passes through 4xx errors raised by Fastify itself', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/test/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });

    expect(response.statusCode).toBe(400);
    expect(ApiErrorSchema.safeParse(response.json()).success).toBe(true);
  });
});
```

### `server/src/routes/health.test.ts`

```ts
import { HealthResponseSchema } from '@shared/api/common';
import { createTestApp } from '../../test/helpers';

describe('GET /api/health', () => {
  it('reports ok, the database status and the pinned date', async () => {
    const { app, close } = await createTestApp({ today: '2026-10-07' });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      database: 'up',
      today: '2026-10-07',
    });
    await close();
  });

  it('is documented in the OpenAPI spec', async () => {
    const { app, close } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty(['paths', '/api/health', 'get']);
    await close();
  });
});
```

### `src/lib/http.test.ts`

```ts
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
      code: undefined,
    } satisfies Partial<HttpError>);
  });

  it('exposes the API error code from a standard error body', async () => {
    server.use(
      http.post(apiUrl('/items'), () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } },
          { status: 400 },
        ),
      ),
    );

    await expect(
      fetchJson(apiUrl('/items'), ItemSchema, { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' } satisfies Partial<HttpError>);
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

