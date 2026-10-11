import { configDefaults, defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Perf smoke only (`npm run test:perf`): the base config (aliases, environment), but only the
 * perf files, one file at a time and never with coverage, so the timings measure the API and not
 * CPU contention from parallel workers or v8 instrumentation. (Spread, not mergeConfig: that
 * would concatenate `include`/`exclude` with the base lists.)
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.perf.test.ts'],
    exclude: configDefaults.exclude,
    fileParallelism: false,
    coverage: { ...baseConfig.test?.coverage, enabled: false },
  },
});
