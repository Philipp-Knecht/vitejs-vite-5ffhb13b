import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'domain',
          root: './packages/domain',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api-unit',
          root: './apps/api',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api-integration',
          root: './apps/api',
          include: ['test/**/*.test.ts'],
          globalSetup: ['./test/global-setup.ts'],
          // Integration tests share one database; run files sequentially.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
