import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (T-042) against the real API and the real seed. Own ports, so a developer's
 * `npm run dev` (:5173 / :3001) keeps running; both servers fail fast if a port is taken.
 */
const API_PORT = 3101;
const WEB_PORT = 4173;
const isCI = Boolean(process.env.CI);
/** Fresh per run: e2e/support/reset-db.ts deletes it before the API migrates and seeds it. */
const DATABASE_PATH = join(tmpdir(), 'keyloop-e2e', 'app.db');

export default defineConfig({
  testDir: './e2e',
  // Tests are isolated by dealership and vehicle, but they share one database: run serially.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // The Vite dev server serves unbundled modules, so a cold first page load can take several
  // seconds on a busy machine or CI runner; auto-waiting assertions get 10 s instead of 5 s.
  expect: { timeout: 10_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // AC-005.4's desktop resolution; the viewport test also checks other sizes explicitly.
    viewport: { width: 1280, height: 800 },
    // The browser language must not matter (AC-015.1); pin it so runs are reproducible.
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Locally the installed Google Chrome (no browser download); CI installs Chromium.
        channel: isCI ? undefined : 'chrome',
      },
    },
  ],
  webServer: [
    {
      // Real API with a pinned "today", so the seeded ages (90 vs 91 days) are exact.
      // From server/, so tsx resolves the API's tsconfig paths (`@shared/*`). No `--env-file`:
      // a developer's server/.env must not leak into the run; everything is set below.
      command: 'npx tsx ../e2e/support/reset-db.ts && npx tsx src/server.ts',
      cwd: 'server',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: {
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        DATABASE_PATH,
        APP_TODAY: '2026-10-07',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --config e2e/vite.config.ts --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: {
        E2E_API_PORT: String(API_PORT),
        // Process env wins over .env files: always the real API, never the MSW mocks.
        VITE_USE_MOCKS: 'false',
        VITE_API_BASE_URL: '',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
