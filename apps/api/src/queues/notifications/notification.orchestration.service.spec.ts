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

    it(
      'validates fallback configuration before persistence',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'fallback-validation-job',

          queue:
            'notifications',

          notificationId:
            'fallback-validation-001:email',

          status:
            'QUEUED',

          outboxEventId:
            'fallback-validation-outbox',
        });

        const service =
          createService();

        await expect(
          service.fanOut(
            'fallback-validation-001',

            [
              createNotification(
                'email',
                'fallback-validation-001:email',
                'fallback-validation-key:email',
              ),
            ],

            {},

            {
              email: [
                'push',
              ],
            },
          ),
        ).resolves.toMatchObject({
          accepted:
            true,

          fallbackPlans: [
            {
              primary:
                'email',

              fallbacks: [
                'push',
              ],

              sequence: [
                'email',
                'push',
              ],
            },
          ],
        });

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          enqueue.mock.calls[0]?.[0],
        ).toMatchObject({
          channel:
            'email',

          fallbackMetadata: {
            primary:
              'email',

            fallbacks: [
              'push',
            ],

            sequence: [
              'email',
              'push',
            ],

            position:
              0,
          },
        });
      },
    );

    it(
      'rejects a fallback channel that is not part of the fan-out',
      async () => {
        enqueue.mockReset();

        const service =
          createService();

        await expect(
          service.fanOut(
            'fallback-unknown-channel-001',

            [
              createNotification(
                'email',
                'fallback-unknown-channel-001:email',
                'fallback-unknown-key:email',
              ),
            ],

            {},

            {
              email: [
                'push',
              ],

              push: [
                'in-app',
              ],
            },
          ),
        ).rejects.toThrow(
          'Fallback configuration references channel "push" that is not part of the notification fan-out.',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a fallback sequence that violates channel policy',
      async () => {
        enqueue.mockReset();

        const service =
          createService(
            new NotificationChannelPolicy({
              allowedChannels: [
                'email',
                'push',
              ],

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
            'fallback-policy-001',

            [
              createNotification(
                'email',
                'fallback-policy-001:email',
                'fallback-policy-key:email',
              ),
            ],

            {},

            {
              email: [
                'push',
              ],
            },
          ),
        ).rejects.toThrow(
          'Notification channels "email" and "push" cannot be selected together.',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not change existing single-channel behavior when no fallback map is supplied',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'single-channel-job',

          queue:
            'notifications',

          notificationId:
            'single-channel-001',

          status:
            'QUEUED',

          outboxEventId:
            'single-channel-outbox',
        });

        const service =
          createService();

        const result =
          await service.fanOut(
            'single-channel-001',

            [
              createNotification(
                'email',
                'single-channel-001:email',
                'single-channel-key:email',
              ),
            ],
          );

        expect(
          result.fallbackPlans,
        ).toEqual([]);

        expect(
          result.channels,
        ).toHaveLength(
          1,
        );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'adds deterministic fallback metadata to the primary channel job',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'fallback-metadata-email',

          queue:
            'notifications',

          notificationId:
            'fallback-metadata-001:email',

          status:
            'QUEUED',

          outboxEventId:
            'fallback-metadata-outbox',
        });

        const service =
          createService();

        await service.fanOut(
          'fallback-metadata-001',

          [
            createNotification(
              'email',
              'fallback-metadata-001:email',
              'fallback-metadata-key:email',
            ),
          ],

          {},

          {
            email: [
              'push',
            ],
          },
        );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );

        const queuedData =
          enqueue.mock.calls[0]?.[0] as {
            readonly fallbackMetadata:
              | {
                  readonly planId:
                    string;

                  readonly orchestrationId:
                    string;

                  readonly primary:
                    string;

                  readonly fallbacks:
                    readonly string[];

                  readonly sequence:
                    readonly string[];

                  readonly position:
                    number;
                }
              | undefined;
          };

        expect(
          queuedData.fallbackMetadata,
        ).toBeDefined();

        expect(
          queuedData.fallbackMetadata,
        ).toMatchObject({
          orchestrationId:
            'fallback-metadata-001',

          primary:
            'email',

          fallbacks: [
            'push',
          ],

          sequence: [
            'email',
            'push',
          ],

          position:
            0,
        });

        expect(
          queuedData.fallbackMetadata?.planId,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );
      },
    );

    it(
      'keeps fallback plan identity stable across repeated planning',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'fallback-stable-job',

          queue:
            'notifications',

          notificationId:
            'fallback-stable-001:email',

          status:
            'QUEUED',

          outboxEventId:
            'fallback-stable-outbox',
        });

        const service =
          createService();

        const createPlanId =
          async () => {
            await service.fanOut(
              'fallback-stable-001',

              [
                createNotification(
                  'email',
                  'fallback-stable-001:email',
                  'fallback-stable-key:email',
                ),
              ],

              {},

              {
                email: [
                  'push',
                ],
              },
            );

            const queuedData =
              enqueue.mock.calls[0]?.[0] as {
                readonly fallbackMetadata:
                  | {
                      readonly planId:
                        string;
                    }
                  | undefined;
              };

            const planId =
              queuedData
                .fallbackMetadata
                ?.planId;

            if (
              planId ===
              undefined
            ) {
              throw new Error(
                'Expected fallback planId to be persisted on the primary notification.',
              );
            }

            return planId;
          };

        const firstPlanId =
          await createPlanId();

        enqueue.mockClear();

        const secondPlanId =
          await createPlanId();

        expect(
          firstPlanId,
        ).toBe(
          secondPlanId,
        );
      },
    );

    it(
      'does not independently enqueue fallback targets',
      async () => {
        enqueue.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'fallback-primary-job',

          queue:
            'notifications',

          notificationId:
            'fallback-primary-001:email',

          status:
            'QUEUED',

          outboxEventId:
            'fallback-primary-outbox',
        });

        const service =
          createService();

        const result =
          await service.fanOut(
            'fallback-primary-001',

            [
              createNotification(
                'email',
                'fallback-primary-001:email',
                'fallback-primary-key:email',
              ),
            ],

            {},

            {
              email: [
                'push',
              ],
            },
          );

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result.channels,
        ).toHaveLength(
          1,
        );

        expect(
          result.channels[0]?.channel,
        ).toBe(
          'email',
        );

        expect(
          result.fallbackPlans,
        ).toEqual([
          {
            primary:
              'email',

            fallbacks: [
              'push',
            ],

            sequence: [
              'email',
              'push',
            ],
          },
        ]);

        const queuedData =
          enqueue.mock.calls[0]?.[0] as {
            readonly fallbackMetadata:
              | {
                  readonly position:
                    number;

                  readonly sequence:
                    readonly string[];
                }
              | undefined;
          };

        expect(
          queuedData.fallbackMetadata,
        ).toMatchObject({
          position:
            0,

          sequence: [
            'email',
            'push',
          ],
        });
      },
    );

    it(
      'rejects a fallback target that is independently scheduled',
      async () => {
        enqueue.mockReset();

        const service =
          createService();

        await expect(
          service.fanOut(
            'fallback-duplicate-target-001',

            [
              createNotification(
                'email',
                'fallback-duplicate-target-001:email',
                'fallback-duplicate-target-key:email',
              ),

              createNotification(
                'push',
                'fallback-duplicate-target-001:push',
                'fallback-duplicate-target-key:push',
              ),
            ],

            {},

            {
              email: [
                'push',
              ],
            },
          ),
        ).rejects.toThrow(
          'Fallback target channel "push" must not also be independently scheduled in the same notification fan-out.',
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();
      },
    );
  },
);