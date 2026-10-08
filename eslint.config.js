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
    // Playwright artifacts (the HTML report ships its own JS)
    'playwright-report',
    'test-results',
    'blob-report',
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
    // Inside a feature, sibling folders (components -> api/hooks) are reached with one `../`.
    // Leaving the feature (`../../`) or deep-importing another feature stays forbidden.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*'],
              message: 'Leave a feature through the @/ alias, not parent-relative imports.',
            },
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
    // Files directly in a feature root (index.ts, types.ts, store.ts) have no sibling folder
    // above them inside the feature: any `../` leaves the feature, so it stays forbidden.
    files: ['src/features/*/*.{ts,tsx}'],
    rules: {
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
    // Playwright (Node): specs drive the app through the browser only. The relative import is
    // e2e/vite.config.ts extending the app's Vite config.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/*'], message: 'E2E tests use the app through the browser, not src/.' },
          ],
        },
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
    // The test setup registers every Zustand store for reset (src/test/setup.ts). It imports a
    // feature's store module directly, so the barrel's components aren't loaded by every test file.
    files: ['src/test/setup.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../*'], message: 'Use the @/ alias instead of parent-relative imports.' },
            {
              group: ['@/features/*/*', '!@/features/*/store'],
              message: 'Import other features only through their index.ts (@/features/<name>).',
            },
          ],
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
