import {
  BadRequestException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationApplicationService,
} from './notification.application.service.js';

import {
  NotificationCommandController,
} from './notification.command.controller.js';

describe(
  'NotificationCommandController',
  () => {
    const enqueue =
      vi.fn();

    const getByNotificationId =
      vi.fn();

    const queue = {
      enqueue,

      getByNotificationId,
    };

    let application:
      NotificationApplicationService;

    let controller:
      NotificationCommandController;

    beforeEach(
      () => {
        enqueue.mockReset();

        getByNotificationId.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'notification-push-001',

          queue:
            'notifications',

          notificationId:
            'notification-push-001',

          status:
            'QUEUED',

          outboxEventId:
            'outbox-push-001',
        });

        application =
          new NotificationApplicationService(
            queue as never,
          );

        controller =
          new NotificationCommandController(
            application,
          );
      },
    );

    it(
      'accepts a valid PUSH command',
      async () => {
        const result =
          await controller.create({
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
              'push-valid-001',

            content: {
              title:
                'New course available',

              body:
                'Advanced JavaScript is now available.',
            },
          });

        expect(
          result,
        ).toEqual({
          jobId:
            'notification-push-001',

          queue:
            'notifications',

          notificationId:
            'notification-push-001',

          status:
            'QUEUED',

          outboxEventId:
            'outbox-push-001',
        });

        expect(
          enqueue,
        ).toHaveBeenCalledOnce();

        expect(
          enqueue,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationId:
              expect.any(String),

            channel:
              'push',

            idempotencyKey:
              'push-valid-001',

            body:
              'Advanced JavaScript is now available.',
          }),
          {},
        );
      },
    );

    it(
      'D - rejects PUSH notifications without device tokens',
      async () => {
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'push',

            recipient: {
              userId:
                'user-001',
            },

            idempotencyKey:
              'push-d-001',

            content: {
              body:
                'Test notification.',
            },
          }),
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
      'E - rejects PUSH notifications with an empty device token',
      async () => {
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'push',

            recipient: {
              userId:
                'user-001',

              deviceTokens: [
                '',
              ],
            },

            idempotencyKey:
              'push-e-001',

            content: {
              body:
                'Test notification.',
            },
          }),
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
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'push',

            recipient: {
              userId:
                'user-001',

              deviceTokens: [
                'token-001',
                'token-001',
              ],
            },

            idempotencyKey:
              'push-f-001',

            content: {
              body:
                'Test notification.',
            },
          }),
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
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'push',

            recipient: {
              userId:
                'user-002',

              deviceTokens: [
                'token-001',
              ],
            },

            idempotencyKey:
              'push-g-001',

            content: {
              body:
                'Test notification.',
            },
          }),
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
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'email',

            recipient: {
              userId:
                'user-001',

              email:
                'user@example.com',
            },

            idempotencyKey:
              'notification-h-001',

            template: {
              templateId:
                'course-welcome-003',

              templateData: {},
            },

            content: {
              body:
                'Literal content must not be combined with a template.',
            },
          }),
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
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'email',

            recipient: {
              userId:
                'user-001',

              email:
                'user@example.com',
            },

            idempotencyKey:
              'notification-i-001',
          }),
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
      'accepts a valid EMAIL literal-content request',
      async () => {
        await controller.create({
          userId:
            'user-email-001',

          channel:
            'email',

          recipient: {
            userId:
              'user-email-001',

            email:
              'user@example.com',
          },

          idempotencyKey:
            'email-content-001',

          content: {
            subject:
              'Welcome',

            title:
              'Welcome to Gurusthalam',

            body:
              'Your account is ready.',
          },
        });

        expect(
          enqueue,
        ).toHaveBeenCalledOnce();

        expect(
          enqueue,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            channel:
              'email',

            body:
              'Your account is ready.',

            subject:
              'Welcome',

            title:
              'Welcome to Gurusthalam',

            idempotencyKey:
              'email-content-001',

            recipient:
              {
                userId:
                  'user-email-001',

                email:
                  'user@example.com',
              },
          }),
          {},
        );
      },
    );

    it(
      'accepts a valid EMAIL template request',
      async () => {
        enqueue.mockResolvedValueOnce({
          jobId:
            'notification-template-001',

          queue:
            'notifications',

          notificationId:
            'notification-template-001',

          status:
            'QUEUED',

          outboxEventId:
            'outbox-template-001',
        });

        await controller.create({
          userId:
            'user-template-001',

          channel:
            'email',

          recipient: {
            userId:
              'user-template-001',

            email:
              'template@example.com',
          },

          idempotencyKey:
            'template-001',

          template: {
            templateId:
              'course-welcome-003',

            templateData: {
              user: {
                firstName:
                  'Uttam',
              },

              course: {
                title:
                  'Advanced JavaScript',
              },
            },

            locale:
              'en-IN',
          },
        });

        expect(
          enqueue,
        ).toHaveBeenCalledOnce();

        expect(
          enqueue,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationId:
              expect.any(String),

            channel:
              'email',

            template:
              'course-welcome-003',

            templateData:
              {
                user: {
                  firstName:
                    'Uttam',
                },

                course: {
                  title:
                    'Advanced JavaScript',
                },
              },

            idempotencyKey:
              'template-001',
          }),
          {
            locale:
              'en-IN',
          },
        );
      },
    );

    it(
      'rejects an unknown top-level property',
      async () => {
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'email',

            recipient: {
              userId:
                'user-001',

              email:
                'user@example.com',
            },

            idempotencyKey:
              'unknown-field-001',

            content: {
              body:
                'Test.',
            },

            unexpectedField:
              'must-not-be-accepted',
          }),
        ).rejects.toThrow(
          new BadRequestException(
            'Unknown property "unexpectedField" in notification request.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an unknown recipient property',
      async () => {
        await expect(
          controller.create({
            userId:
              'user-001',

            channel:
              'email',

            recipient: {
              userId:
                'user-001',

              email:
                'user@example.com',

              unexpected:
                'must-not-be-accepted',
            },

            idempotencyKey:
              'unknown-recipient-field-001',

            content: {
              body:
                'Test.',
            },
          }),
        ).rejects.toThrow(
          new BadRequestException(
            'Unknown property "unexpected" in recipient.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );
  },
);