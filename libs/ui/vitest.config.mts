import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@gurusthalam/ui',
    root: import.meta.dirname,
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
      include: ['src/**/*.tsx'],
      exclude: ['src/**/*.spec.tsx', 'src/**/*.test.tsx'],
    },
  },
});
