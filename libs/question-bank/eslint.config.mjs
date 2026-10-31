import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,

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
                'Question Bank domain code must not depend on Prisma. Use an application or infrastructure adapter.',
            },
            {
              name: 'bullmq',
              message: 'Question Bank domain code must not depend on BullMQ.',
            },
            {
              name: 'ioredis',
              message:
                'Question Bank domain code must not depend on Redis infrastructure.',
            },
            {
              name: 'redis',
              message:
                'Question Bank domain code must not depend on Redis infrastructure.',
            },
            {
              name: 'typeorm',
              message:
                'Question Bank domain code must not depend on persistence infrastructure.',
            },
            {
              name: 'drizzle-orm',
              message:
                'Question Bank domain code must not depend on persistence infrastructure.',
            },
            {
              name: 'firebase-admin',
              message:
                'Question Bank domain code must not depend on external infrastructure SDKs.',
            },
            {
              name: 'kafkajs',
              message:
                'Question Bank domain code must not depend on messaging infrastructure.',
            },
            {
              name: 'amqplib',
              message:
                'Question Bank domain code must not depend on messaging infrastructure.',
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
                'Question Bank domain code must remain independent of frameworks, persistence and infrastructure SDKs.',
            },
          ],
        },
      ],
    },
  },

  {
    ignores: ['**/out-tsc'],
  },
];
