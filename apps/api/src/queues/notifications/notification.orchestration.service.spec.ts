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
  NotificationChannelPolicy,
} from './notification.channel-policy.js';

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

    const createService =
      (
        policy?:
          NotificationChannelPolicy,
      ) =>
        new NotificationOrchestrationService(
          queue,
          policy,
        );

    it(
      'orders channels according to the policy',
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

        const service =
          createService(
            new NotificationChannelPolicy({
              preferredOrder: [
                'push',
                'in-app',
                'email',
              ],
            }),
          );

        const result =
          await service.fanOut(
            'policy-order-001',

            [
              createNotification(
                'email',
                'policy-order-001:email',
                'policy-order-key:email',
              ),

              createNotification(
                'push',
                'policy-order-001:push',
                'policy-order-key:push',
              ),

              createNotification(
                'in-app',
                'policy-order-001:in-app',
                'policy-order-key:in-app',
              ),
            ],
          );

        expect(
          result.channels.map(
            (
              item,
            ) =>
              item.channel,
          ),
        ).toEqual([
          'push',
          'in-app',
          'email',
        ]);

        expect(
          enqueue.mock.calls.map(
            (
              call,
            ) =>
              (
                call[0] as {
                  readonly channel:
                    string;
                }
              ).channel,
          ),
        ).toEqual([
          'push',
          'in-app',
          'email',
        ]);
      },
    );

    it(
      'rejects policy-disallowed channels before persistence',
      async () => {
        enqueue.mockReset();

        const service =
          createService(
            new NotificationChannelPolicy({
              allowedChannels: [
                'email',
                'push',
              ],
            }),
          );

        await expect(
          service.fanOut(
            'policy-allowed-001',

            [
              createNotification(
                'email',
                'policy-allowed-001:email',
                'policy-allowed-key:email',
              ),

              createNotification(
                'in-app',
                'policy-allowed-001:in-app',
                'policy-allowed-key:in-app',
              ),
            ],
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'Notification channel "in-app" is not allowed by the channel policy.',
          ),
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'enforces mandatory channels before persistence',
      async () => {
        enqueue.mockReset();

        const service =
          createService(
            new NotificationChannelPolicy({
              mandatoryChannels: [
                'email',
              ],
            }),
          );

        await expect(
          service.fanOut(
            'policy-mandatory-001',

            [
              createNotification(
                'push',
                'policy-mandatory-001:push',
                'policy-mandatory-key:push',
              ),
            ],
          ),
        ).rejects.toThrow(
          'Notification channel "email" is mandatory',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'enforces mutually-exclusive channels before persistence',
      async () => {
        enqueue.mockReset();

        const service =
          createService(
            new NotificationChannelPolicy({
              mutuallyExclusiveChannels: [
                [
                  'email',
                  'push',
                ],
              ],
            }),
          );

        await expect(
          service.fanOut(
            'policy-exclusive-001',

            [
              createNotification(
                'email',
                'policy-exclusive-001:email',
                'policy-exclusive-key:email',
              ),

              createNotification(
                'push',
                'policy-exclusive-001:push',
                'policy-exclusive-key:push',
              ),
            ],
          ),
        ).rejects.toThrow(
          'cannot be selected together',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'enforces the maximum number of channels',
      async () => {
        enqueue.mockReset();

        const service =
          createService(
            new NotificationChannelPolicy({
              maximumChannels:
                2,
            }),
          );

        await expect(
          service.fanOut(
            'policy-max-001',

            [
              createNotification(
                'email',
                'policy-max-001:email',
                'policy-max-key:email',
              ),

              createNotification(
                'push',
                'policy-max-001:push',
                'policy-max-key:push',
              ),

              createNotification(
                'in-app',
                'policy-max-001:in-app',
                'policy-max-key:in-app',
              ),
            ],
          ),
        ).rejects.toThrow(
          'At most 2 notification channels may be selected',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects duplicate channels before persistence',
      async () => {
        enqueue.mockReset();

        await expect(
          createService().fanOut(
            'orchestration-duplicate',

            [
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
          'Notification channels must not contain duplicates.',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

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
          await createService().fanOut(
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
      },
    );
  },
);