import {
  fileURLToPath,
} from 'node:url';

import {
  defineConfig,
} from 'vitest/config';

const apiRoot =
  fileURLToPath(
    new URL(
      '.',
      import.meta.url,
    ),
  );

export default defineConfig({
  root:
    apiRoot,

  test: {
    include: [
      'src/**/*.{test,spec}.ts',
    ],

    exclude: [
      'dist/**',
      'out-tsc/**',
      'node_modules/**',
      '.git/**',
      '.nx/**',
    ],
  },
});