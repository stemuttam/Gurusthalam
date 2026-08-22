import {
  defineConfig,
} from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'apps/worker/src/**/*.{test,spec}.ts',
    ],

    exclude: [
      'apps/worker/dist/**',
      'apps/worker/out-tsc/**',
      'node_modules/**',
      '.git/**',
      '.nx/**',
    ],

    setupFiles: [
      'apps/worker/vitest.setup.ts',
    ],
  },
});