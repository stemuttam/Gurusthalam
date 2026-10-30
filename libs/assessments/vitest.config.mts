import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/assessments',

  test: {
    name: '@gurusthalam/assessments',
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    passWithNoTests: false,
  },
});
