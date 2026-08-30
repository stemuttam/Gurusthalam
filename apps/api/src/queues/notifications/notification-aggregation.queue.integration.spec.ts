import {
  BadRequestException,
} from '@nestjs/common';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationAggregationBuilder,
} from './notification-aggregation.builder.js';

import {
  NotificationAggregationFlushService,
} from './notification-aggregation.flush.service.js';

import {
  NotificationAggregationQueueIntegrationService,
} from './notification-aggregation.queue.integration.service.js';

import {
  NotificationAggregationSourceEventResolver,
} from './notification-aggregation.source-event.resolver.js';

import {
  NotificationQueueService,
} from './notification.queue.js';

import type {
  NotificationJobData,
} from './notification.types.js';

import type {
  NotificationAggregationFlushSnapshot,
} from './notification-aggregation.flush.service.js';

import type {
  NotificationAggregationSourceEvent,
} from './notification-aggregation.source-event.resolver.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

describe(
  'NotificationAggregationQueueIntegrationService',
  () => {
    const now =
      new Date(
        '2026-08-29T10:00:00.000Z',
      );

    const aggregationId =
      'aggregation-test-001';

    const group =
      createGroup(
        aggregationId,
      );

    const claimedGroup:
      NotificationAggregationRepositoryGroup = {
      ...group,

      status:
        'FLUSHING',
    };

    const items = [
      createItem(
        'source-event-001',
        '2026-08-29T09:50:00.000Z',
      ),

      createItem(
        'source-event-002',
        '2026-08-29T09:51:00.000Z',
      ),
    ];

    const snapshot:
      NotificationAggregationFlushSnapshot = {
      group,

      items,
    };

    const sourceEvents = [
      createSourceEvent(
        'source-event-001',
        'First notification',
      ),

      createSourceEvent(
        'source-event-002',
        'Second notification',
      ),
    ];

    const notificationData:
      NotificationJobData = {
      notificationId:
        'aggregation-notification-001',

      channel:
        'email',

      recipient: {
        userId:
          'user-001',

        email:
          'student@example.com',
      },

      body:
        'First notification\nSecond notification',

      idempotencyKey:
        `notification-aggregation:${aggregationId}`,
    };

    const enqueueResult = {
      jobId:
        notificationData.idempotencyKey,

      queue:
        'notifications',

      notificationId:
        notificationData.notificationId,

      status:
        'QUEUED',

      outboxEventId:
        'outbox-event-001',
    };

    function createService() {
      const flushService = {
        findExpiredSnapshots:
          vi.fn(),

        claimExpiredForFlushing:
          vi.fn(),

        getItems:
          vi.fn(),

        markFlushed:
          vi.fn(),

        markFailed:
          vi.fn(),
      } as unknown as NotificationAggregationFlushService;

      const sourceEventResolver = {
        resolveMany:
          vi.fn(),
      } as unknown as NotificationAggregationSourceEventResolver;

      const builder = {
        build:
          vi.fn(),
      } as unknown as NotificationAggregationBuilder;

      const notificationQueue = {
        enqueue:
          vi.fn(),
      } as unknown as NotificationQueueService;

      const service =
        new NotificationAggregationQueueIntegrationService(
          flushService,
          sourceEventResolver,
          builder,
          notificationQueue,
        );

      return {
        service,

        flushService,

        sourceEventResolver,

        builder,

        notificationQueue,
      };
    }

    it(
      'flushes an expired aggregation through the existing notification queue pipeline',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          items,
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        ).mockResolvedValue(
          sourceEvents,
        );

        vi.mocked(
          builder.build,
        ).mockReturnValue(
          notificationData,
        );

        vi.mocked(
          notificationQueue.enqueue,
        ).mockResolvedValue(
          enqueueResult,
        );

        vi.mocked(
          flushService.markFlushed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FLUSHED',
          },
        );

        const result =
          await service.flush(
            aggregationId,

            now,
          );

        expect(
          flushService.claimExpiredForFlushing,
        ).toHaveBeenCalledWith(
          aggregationId,

          now,
        );

        expect(
          flushService.getItems,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          sourceEventResolver.resolveMany,
        ).toHaveBeenCalledWith(
          [
            'source-event-001',

            'source-event-002',
          ],
        );

        /*
         * The aggregation is atomically claimed before the
         * notification is built.
         *
         * Therefore the builder must receive the claimed
         * FLUSHING group rather than the original OPEN group.
         */
        expect(
          builder.build,
        ).toHaveBeenCalledWith(
          {
            group:
              claimedGroup,

            items,

            sourceEvents,
          },
        );

        expect(
          notificationQueue.enqueue,
        ).toHaveBeenCalledWith(
          notificationData,
        );

        expect(
          flushService.markFlushed,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          result,
        ).toEqual(
          {
            aggregationId,

            notificationId:
              enqueueResult.notificationId,

            queue:
              enqueueResult.queue,

            jobId:
              enqueueResult.jobId,

            outboxEventId:
              enqueueResult.outboxEventId,

            itemCount:
              items.length,

            status:
              'FLUSHED',
          },
        );
      },
    );

    it(
      'preserves deterministic source-event ordering when resolving an aggregation',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          items,
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        ).mockResolvedValue(
          sourceEvents,
        );

        vi.mocked(
          builder.build,
        ).mockReturnValue(
          notificationData,
        );

        vi.mocked(
          notificationQueue.enqueue,
        ).mockResolvedValue(
          enqueueResult,
        );

        vi.mocked(
          flushService.markFlushed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FLUSHED',
          },
        );

        await service.flush(
          aggregationId,

          now,
        );

        expect(
          sourceEventResolver.resolveMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          sourceEventResolver.resolveMany,
        ).toHaveBeenCalledWith(
          items.map(
            (item) =>
              item.sourceEventId,
          ),
        );

        expect(
          builder.build,
        ).toHaveBeenCalledWith(
          expect.objectContaining(
            {
              group:
                claimedGroup,

              items,

              sourceEvents,
            },
          ),
        );
      },
    );

    it(
      'marks the aggregation FAILED when source-event resolution fails',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        const error =
          new Error(
            'source event resolution failed',
          );

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          items,
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        ).mockRejectedValue(
          error,
        );

        vi.mocked(
          flushService.markFailed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FAILED',
          },
        );

        await expect(
          service.flush(
            aggregationId,

            now,
          ),
        ).rejects.toBe(
          error,
        );

        expect(
          builder.build,
        ).not.toHaveBeenCalled();

        expect(
          notificationQueue.enqueue,
        ).not.toHaveBeenCalled();

        expect(
          flushService.markFailed,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          flushService.markFlushed,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'marks the aggregation FAILED when notification building fails',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        const error =
          new Error(
            'notification building failed',
          );

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          items,
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        ).mockResolvedValue(
          sourceEvents,
        );

        vi.mocked(
          builder.build,
        ).mockImplementation(
          () => {
            throw error;
          },
        );

        vi.mocked(
          flushService.markFailed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FAILED',
          },
        );

        await expect(
          service.flush(
            aggregationId,

            now,
          ),
        ).rejects.toBe(
          error,
        );

        expect(
          notificationQueue.enqueue,
        ).not.toHaveBeenCalled();

        expect(
          flushService.markFailed,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          flushService.markFlushed,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'marks the aggregation FAILED when queue enqueue fails',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        const error =
          new Error(
            'notification queue enqueue failed',
          );

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          items,
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        ).mockResolvedValue(
          sourceEvents,
        );

        vi.mocked(
          builder.build,
        ).mockReturnValue(
          notificationData,
        );

        vi.mocked(
          notificationQueue.enqueue,
        ).mockRejectedValue(
          error,
        );

        vi.mocked(
          flushService.markFailed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FAILED',
          },
        );

        await expect(
          service.flush(
            aggregationId,

            now,
          ),
        ).rejects.toBe(
          error,
        );

        expect(
          flushService.markFailed,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          flushService.markFlushed,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not enqueue or change status when the aggregation is not eligible',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          null,
        );

        await expect(
          service.flush(
            aggregationId,

            now,
          ),
        ).rejects.toThrow(
          BadRequestException,
        );

        expect(
          flushService.claimExpiredForFlushing,
        ).toHaveBeenCalledWith(
          aggregationId,

          now,
        );

        expect(
          flushService.getItems,
        ).not.toHaveBeenCalled();

        expect(
          sourceEventResolver.resolveMany,
        ).not.toHaveBeenCalled();

        expect(
          builder.build,
        ).not.toHaveBeenCalled();

        expect(
          notificationQueue.enqueue,
        ).not.toHaveBeenCalled();

        expect(
          flushService.markFlushed,
        ).not.toHaveBeenCalled();

        expect(
          flushService.markFailed,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an empty aggregation and marks it FAILED',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        vi.mocked(
          flushService.claimExpiredForFlushing,
        ).mockResolvedValue(
          claimedGroup,
        );

        vi.mocked(
          flushService.getItems,
        ).mockResolvedValue(
          [],
        );

        vi.mocked(
          flushService.markFailed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FAILED',
          },
        );

        await expect(
          service.flush(
            aggregationId,

            now,
          ),
        ).rejects.toThrow(
          `Notification aggregation "${aggregationId}" contains no items.`,
        );

        expect(
          flushService.claimExpiredForFlushing,
        ).toHaveBeenCalledWith(
          aggregationId,

          now,
        );

        expect(
          flushService.getItems,
        ).toHaveBeenCalledWith(
          aggregationId,
        );

        expect(
          sourceEventResolver.resolveMany,
        ).not.toHaveBeenCalled();

        expect(
          builder.build,
        ).not.toHaveBeenCalled();

        expect(
          notificationQueue.enqueue,
        ).not.toHaveBeenCalled();

        expect(
          flushService.markFailed,
        ).toHaveBeenCalledWith(
          aggregationId,
        );
      },
    );

    it(
      'processes expired aggregations independently',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        const secondGroup =
          createGroup(
            'aggregation-test-002',
          );

        const secondClaimedGroup:
          NotificationAggregationRepositoryGroup = {
          ...secondGroup,

          status:
            'FLUSHING',
        };

        const secondSnapshot:
          NotificationAggregationFlushSnapshot = {
          group:
            secondGroup,

          items: [
            createItem(
              'source-event-003',
              '2026-08-29T09:52:00.000Z',
            ),
          ],
        };

        vi.mocked(
          flushService.findExpiredSnapshots,
        ).mockResolvedValue(
          [
            snapshot,

            secondSnapshot,
          ],
        );

        vi.mocked(
          flushService.claimExpiredForFlushing,
        )
          .mockResolvedValueOnce(
            claimedGroup,
          )
          .mockResolvedValueOnce(
            secondClaimedGroup,
          );

        vi.mocked(
          flushService.getItems,
        )
          .mockResolvedValueOnce(
            items,
          )
          .mockResolvedValueOnce(
            [...secondSnapshot.items],
          );

        vi.mocked(
          flushService.markFlushed,
        ).mockResolvedValue(
          {
            ...claimedGroup,

            status:
              'FLUSHED',
          },
        );

        vi.mocked(
          flushService.markFailed,
        ).mockResolvedValue(
          {
            ...secondClaimedGroup,

            status:
              'FAILED',
          },
        );

        vi.mocked(
          sourceEventResolver.resolveMany,
        )
          .mockResolvedValueOnce(
            sourceEvents,
          )
          .mockRejectedValueOnce(
            new Error(
              'second aggregation failed',
            ),
          );

        vi.mocked(
          builder.build,
        ).mockReturnValue(
          notificationData,
        );

        vi.mocked(
          notificationQueue.enqueue,
        ).mockResolvedValue(
          enqueueResult,
        );

        const results =
          await service.flushExpired(
            now,
          );

        expect(
          results,
        ).toHaveLength(
          1,
        );

        expect(
          results[0]?.aggregationId,
        ).toBe(
          aggregationId,
        );

        expect(
          flushService.findExpiredSnapshots,
        ).toHaveBeenCalledWith(
          now,
        );

        expect(
          flushService.claimExpiredForFlushing,
        ).toHaveBeenNthCalledWith(
          1,

          aggregationId,

          now,
        );

        expect(
          flushService.claimExpiredForFlushing,
        ).toHaveBeenNthCalledWith(
          2,

          'aggregation-test-002',

          now,
        );

        expect(
          flushService.markFailed,
        ).toHaveBeenCalledWith(
          'aggregation-test-002',
        );
      },
    );

    it(
      'rejects an empty aggregation ID before accessing dependencies',
      async () => {
        const {
          service,

          flushService,

          sourceEventResolver,

          builder,

          notificationQueue,
        } =
          createService();

        await expect(
          service.flush(
            '   ',

            now,
          ),
        ).rejects.toThrow(
          'aggregationId must be non-empty.',
        );

        expect(
          flushService.claimExpiredForFlushing,
        ).not.toHaveBeenCalled();

        expect(
          flushService.getItems,
        ).not.toHaveBeenCalled();

        expect(
          sourceEventResolver.resolveMany,
        ).not.toHaveBeenCalled();

        expect(
          builder.build,
        ).not.toHaveBeenCalled();

        expect(
          notificationQueue.enqueue,
        ).not.toHaveBeenCalled();
      },
    );

    function createGroup(
      id: string,
    ): NotificationAggregationRepositoryGroup {
      return {
        aggregationId:
          id,

        groupKey:
          'user-001|email|course|course-update|en-IN',

        userId:
          'user-001',

        channel:
          'email',

        category:
          'course',

        aggregationKey:
          'course-update',

        locale:
          'en-IN',

        windowStart:
          new Date(
            '2026-08-29T09:45:00.000Z',
          ),

        windowEnd:
          new Date(
            '2026-08-29T09:50:00.000Z',
          ),

        itemCount:
          2,

        status:
          'OPEN',
      } as unknown as NotificationAggregationRepositoryGroup;
    }

    function createItem(
      sourceEventId: string,
      occurredAt: string,
    ): NotificationAggregationRepositoryItem {
      return {
        sourceEventId,

        occurredAt:
          new Date(
            occurredAt,
          ),

        orderingKey:
          `${new Date(occurredAt).getTime()}|${sourceEventId}`,
      } as unknown as NotificationAggregationRepositoryItem;
    }

    function createSourceEvent(
      sourceEventId: string,
      body: string,
    ): NotificationAggregationSourceEvent {
      return {
        sourceEventId,

        notificationId:
          sourceEventId,

        data: {
          notificationId:
            sourceEventId,

          channel:
            'email',

          recipient: {
            userId:
              'user-001',

            email:
              'student@example.com',
          },

          body,

          idempotencyKey:
            `notification:${sourceEventId}`,
        },
      };
    }
  },
);