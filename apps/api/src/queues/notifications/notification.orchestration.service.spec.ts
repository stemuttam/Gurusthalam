import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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
          result,
        ).toEqual({
          orchestrationId:
            'orchestration-001',

          notificationId:
            'orchestration-001',

          accepted:
            true,

          action:
            'fan-out-scheduled',

          channels: [
            {
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

              channel:
                'email',
            },

            {
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

              channel:
                'push',
            },
          ],
        });
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
          'orchestration-002',

          [
            createNotification(
              'email',
              'orchestration-002:email',
              'key:email',
            ),

            createNotification(
              'in-app',
              'orchestration-002:in-app',
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

        expect(
          enqueue.mock.calls[0]?.[1],
        ).toEqual({
          locale:
            'en-IN',
        });

        expect(
          enqueue.mock.calls[1]?.[1],
        ).toEqual({
          locale:
            'en-IN',
        });
      },
    );

    it(
      'returns an empty successful result for an empty fan-out',
      async () => {
        enqueue.mockReset();

        const result =
          await service.fanOut(
            'orchestration-empty',
            [],
          );

        expect(
          result,
        ).toEqual({
          orchestrationId:
            'orchestration-empty',

          notificationId:
            'orchestration-empty',

          accepted:
            true,

          action:
            'fan-out-scheduled',

          channels:
            [],
        });

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );
  },
);