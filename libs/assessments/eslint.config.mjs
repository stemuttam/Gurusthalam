import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,

  // Preserve existing JSON dependency checks.
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },

  // Assessment domain must remain independent of infrastructure.
  {
    files: ['**/src/domain/**/*.ts'],
    ignores: ['**/src/domain/**/*.spec.ts', '**/src/domain/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Assessment domain code must not depend on Prisma. Use an application or infrastructure adapter.',
            },
            {
              name: 'bullmq',
              message:
                'Assessment domain code must not depend on BullMQ. Use an application or infrastructure adapter.',
            },
            {
              name: 'ioredis',
              message:
                'Assessment domain code must not depend on Redis infrastructure.',
            },
            {
              name: 'redis',
              message:
                'Assessment domain code must not depend on Redis infrastructure.',
            },
            {
              name: 'typeorm',
              message:
                'Assessment domain code must not depend on persistence infrastructure.',
            },
            {
              name: 'drizzle-orm',
              message:
                'Assessment domain code must not depend on persistence infrastructure.',
            },
            {
              name: 'firebase-admin',
              message:
                'Assessment domain code must not depend on external infrastructure SDKs.',
            },
            {
              name: 'kafkajs',
              message:
                'Assessment domain code must not depend on messaging infrastructure.',
            },
            {
              name: 'amqplib',
              message:
                'Assessment domain code must not depend on messaging infrastructure.',
            },
          ],
          patterns: [
            {
              group: [
                '@nestjs',
                '@nestjs/*',
                '@prisma/*',
                '@aws-sdk',
                '@aws-sdk/*',
                '@google-cloud',
                '@google-cloud/*',
              ],
              message:
                'Assessment domain code must remain independent of frameworks, persistence and infrastructure SDKs. Use an application or infrastructure adapter instead.',
            },
          ],
        },
      ],
    },
  },

  // Preserve generated TypeScript output exclusions.
  {
    ignores: ['**/out-tsc'],
  },
];
