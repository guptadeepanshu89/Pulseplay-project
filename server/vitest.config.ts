import { defineConfig } from 'vitest/config';

import { TEST_ENV } from './tests/testEnv';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    env: TEST_ENV,
    // Every test file shares one Postgres schema, so files must not run at the same time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
