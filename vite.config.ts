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
    // Multi-step async UI tests (placeholder data, refetch, navigation) exceeded the 5 s default
    // under CPU contention (parallel agents, CI runners). Assertions still use findBy* waits.
    testTimeout: 15_000,
    // Half the cores (4 of 8 here): measured the same or faster than the default (cores - 1)
    // for the coverage run (84-87 s vs 94-96 s on a loaded machine), with less CPU contention
    // per jsdom worker, which is what made the async UI tests time out.
    maxWorkers: '50%',
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
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
