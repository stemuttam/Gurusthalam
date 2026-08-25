import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertNotificationChannelIdentity,
  createNotificationChannelIdentity,
} from './notification-channel-identity.js';

describe(
  'notification channel identity',
  () => {
    it(
      'creates deterministic channel-specific identities',
      () => {
        expect(
          createNotificationChannelIdentity(
            'course-completion-001',

            'course-completion-key-001',

            'email',
          ),
        ).toEqual({
          channel:
            'email',

          notificationId:
            'course-completion-001:email',

          idempotencyKey:
            'course-completion-key-001:email',
        });
      },
    );

    it(
      'creates different identities for different channels',
      () => {
        const email =
          createNotificationChannelIdentity(
            'notification-001',
            'idempotency-001',
            'email',
          );

        const push =
          createNotificationChannelIdentity(
            'notification-001',
            'idempotency-001',
            'push',
          );

        const inApp =
          createNotificationChannelIdentity(
            'notification-001',
            'idempotency-001',
            'in-app',
          );

        expect(
          new Set([
            email.notificationId,
            push.notificationId,
            inApp.notificationId,
          ]).size,
        ).toBe(
          3,
        );

        expect(
          new Set([
            email.idempotencyKey,
            push.idempotencyKey,
            inApp.idempotencyKey,
          ]).size,
        ).toBe(
          3,
        );
      },
    );

    it(
      'rejects an empty notification identity',
      () => {
        expect(
          () =>
            createNotificationChannelIdentity(
              '',
              'idempotency-001',
              'email',
            ),
        ).toThrow(
          'notificationId must be non-empty.',
        );
      },
    );

    it(
      'rejects an empty idempotency identity',
      () => {
        expect(
          () =>
            createNotificationChannelIdentity(
              'notification-001',
              '',
              'email',
            ),
        ).toThrow(
          'idempotencyKey must be non-empty.',
        );
      },
    );

    it(
      'accepts a canonical child identity',
      () => {
        expect(
          () =>
            assertNotificationChannelIdentity(
              'notification-001',

              'idempotency-001',

              {
                channel:
                  'push',

                notificationId:
                  'notification-001:push',

                idempotencyKey:
                  'idempotency-001:push',
              },
            ),
        ).not.toThrow();
      },
    );

    it(
      'rejects a child notification identity belonging to another channel',
      () => {
        expect(
          () =>
            assertNotificationChannelIdentity(
              'notification-001',

              'idempotency-001',

              {
                channel:
                  'push',

                notificationId:
                  'notification-001:email',

                idempotencyKey:
                  'idempotency-001:push',
              },
            ),
        ).toThrow(
          'Invalid notification identity',
        );
      },
    );

    it(
      'rejects a child idempotency identity belonging to another channel',
      () => {
        expect(
          () =>
            assertNotificationChannelIdentity(
              'notification-001',

              'idempotency-001',

              {
                channel:
                  'push',

                notificationId:
                  'notification-001:push',

                idempotencyKey:
                  'idempotency-001:email',
              },
            ),
        ).toThrow(
          'Invalid idempotency identity',
        );
      },
    );
  },
);