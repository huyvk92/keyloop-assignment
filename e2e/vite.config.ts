/**
 * Vite dev server for the e2e run: the app's own config with the `/api` proxy pointed at the e2e
 * API port, so a developer's servers on :5173/:3001 are neither used nor disturbed. Started by
 * playwright.config.ts with `E2E_API_PORT` set.
 */
import { mergeConfig } from 'vite';
import baseConfig from '../vite.config.ts';

const apiPort = process.env.E2E_API_PORT;
if (!apiPort) throw new Error('E2E_API_PORT must be set for the e2e web server.');

export default mergeConfig(baseConfig, {
  // A separate pre-bundle cache, so this server and a running `npm run dev` never share one.
  cacheDir: 'node_modules/.vite-e2e',
  server: {
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
});
