import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BadRequestException,
} from '@nestjs/common';

import {
  NotificationApplicationService,
} from './notification.application.service.js';

import type {
  NotificationEnqueueResult,
} from './notification.queue.js';

import type {
  CreateNotificationCommand,
} from './notification.command.js';

describe(
  'NotificationApplicationService',
  () => {
    const enqueue =
      vi.fn<
        (
          data: unknown,
          options?: unknown,
        ) =>
          Promise<NotificationEnqueueResult>
      >();

    const queue =
      {
        enqueue,
      } as unknown as {
        enqueue: typeof enqueue;
      };

    const service =
      new NotificationApplicationService(
        queue as never,
      );

    const resetQueue =
      () => {
        enqueue.mockReset();
      };

    const validPushBase =
      (): CreateNotificationCommand => ({
        notificationId:
          'phase-3-2-5-push-test',

        userId:
          'user-001',

        channel:
          'push',

        recipient: {
          userId:
            'user-001',
        },

        idempotencyKey:
          'phase-3-2-5-push-test',

        content: {
          body:
            'Push notification test.',
        },
      });

    const validEmailTemplateBase =
      (): CreateNotificationCommand => ({
        notificationId:
          'phase-3-2-5-template-content-test',

        userId:
          'user-001',

        channel:
          'email',

        recipient: {
          userId:
            'user-001',

          email:
            'user-001@example.com',
        },

        idempotencyKey:
          'phase-3-2-5-template-content-test',

        template: {
          templateId:
            'course-welcome-003',

          templateData: {
            user: {
              firstName:
                'Uttam',
            },
          },
        },
      });

    it(
      'D - rejects PUSH notifications without device tokens',
      async () => {
        resetQueue();

        const command =
          validPushBase();

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'At least one device token is required for push notifications.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'E - rejects PUSH notifications with empty device tokens',
      async () => {
        resetQueue();

        const command:
          CreateNotificationCommand = {
          ...validPushBase(),

          recipient: {
            userId:
              'user-001',

            deviceTokens: [
              '',
            ],
          },
        };

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Push notification device tokens cannot be empty.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'F - rejects duplicate PUSH device tokens',
      async () => {
        resetQueue();

        const command:
          CreateNotificationCommand = {
          ...validPushBase(),

          recipient: {
            userId:
              'user-001',

            deviceTokens: [
              'token-001',
              'token-001',
            ],
          },
        };

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Push notification device tokens must be unique.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'G - rejects recipient.userId mismatches',
      async () => {
        resetQueue();

        const command:
          CreateNotificationCommand = {
          ...validPushBase(),

          userId:
            'user-001',

          recipient: {
            userId:
              'user-002',

            deviceTokens: [
              'token-001',
            ],
          },
        };

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'recipient.userId must match userId.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'H - rejects requests containing both template and literal content',
      async () => {
        resetQueue();

        const base =
          validEmailTemplateBase();

        const command:
          CreateNotificationCommand = {
          ...base,

          content: {
            body:
              'This body should not be accepted together with a template.',
          },
        };

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Exactly one of template or content must be provided.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'I - rejects requests containing neither template nor literal content',
      async () => {
        resetQueue();

        const command:
          CreateNotificationCommand = {
          notificationId:
            'phase-3-2-5-neither-test',

          userId:
            'user-001',

          channel:
            'email',

          recipient: {
            userId:
              'user-001',

            email:
              'user-001@example.com',
          },

          idempotencyKey:
            'phase-3-2-5-neither-test',
        };

        await expect(
          service.create(
            command,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Exactly one of template or content must be provided.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'accepts a valid PUSH request with one device token',
      async () => {
        resetQueue();

        enqueue.mockResolvedValue({
          jobId:
            'phase-3-2-5-push-valid-001',

          queue:
            'notifications',

          notificationId:
            'phase-3-2-5-push-valid-001',

          status:
            'QUEUED',

          outboxEventId:
            'test-outbox-id',
        });

        const command:
          CreateNotificationCommand = {
          notificationId:
            'phase-3-2-5-push-valid-001',

          userId:
            'user-001',

          channel:
            'push',

          recipient: {
            userId:
              'user-001',

            deviceTokens: [
              'token-001',
            ],
          },

          idempotencyKey:
            'phase-3-2-5-push-valid-001',

          content: {
            body:
              'Valid PUSH notification.',
          },
        };

        const result =
          await service.create(
            command,
          );

        expect(
          result.status,
        ).toBe(
          'QUEUED',
        );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);