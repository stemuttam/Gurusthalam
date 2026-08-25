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
  NotificationOrchestrationService,
} from './notification.orchestration.service.js';

import type {
  NotificationQueueService,
} from './notification.queue.js';

describe(
  'NotificationOrchestrationService',
  () => {
    const enqueue =
      vi.fn();

    const queue =
      {
        enqueue,
      } as unknown as
        NotificationQueueService;

    const service =
      new NotificationOrchestrationService(
        queue,
      );

    const createNotification =
      (
        channel:
          'email' |
          'push' |
          'in-app',

        notificationId:
          string,

        idempotencyKey:
          string,
      ) => ({
        notificationId,

        channel,

        recipient: {
          userId:
            'user-001',
        },

        body:
          'Multi-channel orchestration test.',

        idempotencyKey,
      });

    it(
      'fans out one logical notification into independent channel jobs',
      async () => {
        enqueue.mockReset();

        enqueue
          .mockResolvedValueOnce({
            jobId:
              'orchestration-001:email',

            queue:
              'notifications',

            notificationId:
              'orchestration-001:email',

            status:
              'QUEUED',

            outboxEventId:
              'outbox-email',
          })
          .mockResolvedValueOnce({
            jobId:
              'orchestration-001:push',

            queue:
              'notifications',

            notificationId:
              'orchestration-001:push',

            status:
              'QUEUED',

            outboxEventId:
              'outbox-push',
          });

        const result =
          await service.fanOut(
            'orchestration-001',

            [
              createNotification(
                'email',
                'orchestration-001:email',
                'orchestration-key:email',
              ),

              createNotification(
                'push',
                'orchestration-001:push',
                'orchestration-key:push',
              ),
            ],
          );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          result.channels,
        ).toHaveLength(
          2,
        );

        expect(
          new Set(
            result.channels.map(
              (
                item,
              ) =>
                item.channel,
            ),
          ).size,
        ).toBe(
          2,
        );
      },
    );

    it(
      'rejects duplicate channels before persistence',
      async () => {
        enqueue.mockReset();

        await expect(
          service.fanOut(
            'orchestration-duplicate',

            [
              /*
               * Both identities are canonical. The only
               * intentional violation here is the duplicate
               * channel.
               */
              createNotification(
                'email',

                'orchestration-duplicate:email',

                'orchestration-key:email',
              ),

              createNotification(
                'email',

                'orchestration-duplicate:email',

                'orchestration-key:email',
              ),
            ],
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Duplicate channel "email" in notification fan-out.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects duplicate child notification identities',
      async () => {
        enqueue.mockReset();

        await expect(
          service.fanOut(
            'orchestration-duplicate-id',

            [
              createNotification(
                'email',
                'orchestration-duplicate-id:email',
                'orchestration-key:email',
              ),

              createNotification(
                'push',
                'orchestration-duplicate-id:email',
                'orchestration-key:push',
              ),
            ],
          ),
        ).rejects.toThrow(
          'Duplicate notificationId',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects duplicate child idempotency identities',
      async () => {
        enqueue.mockReset();

        await expect(
          service.fanOut(
            'orchestration-duplicate-key',

            [
              createNotification(
                'email',
                'orchestration-duplicate-key:email',
                'orchestration-key:email',
              ),

              createNotification(
                'push',
                'orchestration-duplicate-key:push',
                'orchestration-key:email',
              ),
            ],
          ),
        ).rejects.toThrow(
          'Duplicate idempotencyKey',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a malformed channel notification identity',
      async () => {
        enqueue.mockReset();

        await expect(
          service.fanOut(
            'orchestration-invalid',

            [
              createNotification(
                'email',
                'wrong-notification-id',
                'orchestration-key:email',
              ),
            ],
          ),
        ).rejects.toThrow(
          'Invalid notification identity',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'passes common enqueue options to every channel',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'job',

          queue:
            'notifications',

          notificationId:
            'notification',

          status:
            'QUEUED',

          outboxEventId:
            'outbox',
        });

        await service.fanOut(
          'orchestration-options',

          [
            createNotification(
              'email',
              'orchestration-options:email',
              'key:email',
            ),

            createNotification(
              'in-app',
              'orchestration-options:in-app',
              'key:in-app',
            ),
          ],

          {
            locale:
              'en-IN',
          },
        );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );
  },
);