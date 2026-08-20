import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SafeNotificationTemplateRenderer,
} from '@gurusthalam/shared';

describe(
  'SafeNotificationTemplateRenderer',
  () => {
    const renderer =
      new SafeNotificationTemplateRenderer();

    it(
      'renders body variables',
      async () => {
        const result =
          await renderer.render({
            template: {
              id:
                'template-version-1',

              templateId:
                'welcome',

              version:
                1,

              subject:
                'Welcome {{user.firstName}}',

              title:
                'Hello {{user.firstName}}',

              body:
                'Welcome to {{course.title}}.',

              variables: [
                {
                  path:
                    'user.firstName',

                  required:
                    true,

                  type:
                    'string',
                },

                {
                  path:
                    'course.title',

                  required:
                    true,

                  type:
                    'string',
                },
              ],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {
              user: {
                firstName:
                  'Uttam',
              },

              course: {
                title:
                  'Advanced JavaScript',
              },
            },
          });

        expect(
          result.subject,
        ).toBe(
          'Welcome Uttam',
        );

        expect(
          result.title,
        ).toBe(
          'Hello Uttam',
        );

        expect(
          result.body,
        ).toBe(
          'Welcome to Advanced JavaScript.',
        );
      },
    );

    it(
      'renders nested variables',
      async () => {
        const result =
          await renderer.render({
            template: {
              id:
                'template-version-2',

              templateId:
                'nested',

              version:
                1,

              body:
                'Company: {{company.profile.name}}',

              variables: [
                {
                  path:
                    'company.profile.name',

                  required:
                    true,

                  type:
                    'string',
                },
              ],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {
              company: {
                profile: {
                  name:
                    'Gurusthalam',
                },
              },
            },
          });

        expect(
          result.body,
        ).toBe(
          'Company: Gurusthalam',
        );
      },
    );

    it(
      'renders optional missing values as empty strings',
      async () => {
        const result =
          await renderer.render({
            template: {
              id:
                'template-version-3',

              templateId:
                'optional',

              version:
                1,

              body:
                'Hello {{user.firstName}} {{user.middleName}}',

              variables: [
                {
                  path:
                    'user.firstName',

                  required:
                    true,

                  type:
                    'string',
                },

                {
                  path:
                    'user.middleName',

                  required:
                    false,

                  type:
                    'string',
                },
              ],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {
              user: {
                firstName:
                  'Uttam',
              },
            },
          });

        expect(
          result.body,
        ).toBe(
          'Hello Uttam ',
        );
      },
    );

    it(
      'rejects undeclared variables',
      async () => {
        await expect(
          renderer.render({
            template: {
              id:
                'template-version-4',

              templateId:
                'invalid',

              version:
                1,

              body:
                'Hello {{user.firstName}}',

              variables: [],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {
              user: {
                firstName:
                  'Uttam',
              },
            },
          }),
        ).rejects.toThrow(
          'validation failed',
        );
      },
    );

    it(
      'rejects unsafe variable paths',
      async () => {
        await expect(
          renderer.render({
            template: {
              id:
                'template-version-5',

              templateId:
                'unsafe',

              version:
                1,

              body:
                'Value: {{constructor}}',

              variables: [
                {
                  path:
                    'constructor',

                  required:
                    true,

                  type:
                    'string',
                },
              ],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {},
          }),
        ).rejects.toThrow();
      },
    );

    it(
      'renders numbers and booleans safely',
      async () => {
        const result =
          await renderer.render({
            template: {
              id:
                'template-version-6',

              templateId:
                'types',

              version:
                1,

              body:
                'Progress {{progress}}% Active {{active}}',

              variables: [
                {
                  path:
                    'progress',

                  required:
                    true,

                  type:
                    'number',
                },

                {
                  path:
                    'active',

                  required:
                    true,

                  type:
                    'boolean',
                },
              ],

              status:
                'PUBLISHED',

              createdBy:
                'system',

              createdAt:
                new Date(),
            },

            data: {
              progress:
                85,

              active:
                true,
            },
          });

        expect(
          result.body,
        ).toBe(
          'Progress 85% Active true',
        );
      },
    );
  },
);