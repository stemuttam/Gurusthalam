import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationAggregationFlushService,
} from './notification-aggregation.flush.service.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationService,
} from './notification-aggregation.service.js';

function createGroup(
  overrides: Partial<NotificationAggregationRepositoryGroup> = {},
): NotificationAggregationRepositoryGroup {
  const windowStart =
    new Date(
      '2026-08-28T10:00:00.000Z',
    );

  const windowEnd =
    new Date(
      '2026-08-28T10:05:00.000Z',
    );

  return {
    aggregationId:
      'aggregation-test-001',

    groupKey:
      'user-1|in-app|course.activity|course-1|en-IN',

    userId:
      'user-1',

    channel:
      'in-app',

    category:
      'course.activity',

    aggregationKey:
      'course-1',

    locale:
      'en-IN',

    status:
      'OPEN',

    windowStart,

    windowEnd,

    itemCount:
      2,

    createdAt:
      windowStart,

    updatedAt:
      windowStart,

    ...overrides,
  };
}

function createItem(
  overrides: Partial<NotificationAggregationRepositoryItem> = {},
): NotificationAggregationRepositoryItem {
  return {
    itemId:
      'item-001',

    aggregationId:
      'aggregation-test-001',

    sourceEventId:
      'event-001',

    occurredAt:
      new Date(
        '2026-08-28T10:01:00.000Z',
      ),

    orderingKey:
      '0000001724839260000|event-001',

    createdAt:
      new Date(
        '2026-08-28T10:01:00.000Z',
      ),

    ...overrides,
  };
}

function createServiceMock() {
  return {
    findByAggregationId:
      vi.fn(),

    getItems:
      vi.fn(),

    findExpiredGroups:
      vi.fn(),

    claimExpiredForFlushing:
      vi.fn(),

    markFlushed:
      vi.fn(),

    markFailed:
      vi.fn(),
  } as unknown as NotificationAggregationService;
}

describe(
  'NotificationAggregationFlushService',
  () => {
    it(
      'returns an expired OPEN aggregation snapshot',
      async () => {
        const aggregationService =
          createServiceMock();

        const group =
          createGroup();

        const items = [
          createItem(),

          createItem({
            itemId:
              'item-002',

            sourceEventId:
              'event-002',

            orderingKey:
              '0000001724839320000|event-002',
          }),
        ];

        vi.mocked(
          aggregationService.findByAggregationId,
        ).mockResolvedValue(
          group,
        );

        vi.mocked(
          aggregationService.getItems,
        ).mockResolvedValue(
          items,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const now =
          new Date(
            '2026-08-28T10:10:00.000Z',
          );

        const result =
          await service.getExpiredSnapshot(
            group.aggregationId,
            now,
          );

        expect(
          result,
        ).toEqual({
          group,
          items,
        });

        expect(
          aggregationService.findByAggregationId,
        ).toHaveBeenCalledWith(
          group.aggregationId,
        );

        expect(
          aggregationService.getItems,
        ).toHaveBeenCalledWith(
          group.aggregationId,
        );
      },
    );

    it(
      'returns null when the aggregation group does not exist',
      async () => {
        const aggregationService =
          createServiceMock();

        vi.mocked(
          aggregationService.findByAggregationId,
        ).mockResolvedValue(
          null,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.getExpiredSnapshot(
            'aggregation-missing',

            new Date(
              '2026-08-28T10:10:00.000Z',
            ),
          );

        expect(
          result,
        ).toBeNull();

        expect(
          aggregationService.getItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'returns null when the group is not OPEN',
      async () => {
        const aggregationService =
          createServiceMock();

        vi.mocked(
          aggregationService.findByAggregationId,
        ).mockResolvedValue(
          createGroup({
            status:
              'FLUSHING',
          }),
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.getExpiredSnapshot(
            'aggregation-test-001',

            new Date(
              '2026-08-28T10:10:00.000Z',
            ),
          );

        expect(
          result,
        ).toBeNull();

        expect(
          aggregationService.getItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'returns null when the aggregation window has not expired',
      async () => {
        const aggregationService =
          createServiceMock();

        vi.mocked(
          aggregationService.findByAggregationId,
        ).mockResolvedValue(
          createGroup(),
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.getExpiredSnapshot(
            'aggregation-test-001',

            new Date(
              '2026-08-28T10:04:59.999Z',
            ),
          );

        expect(
          result,
        ).toBeNull();

        expect(
          aggregationService.getItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'treats windowEnd as expired',
      async () => {
        const aggregationService =
          createServiceMock();

        const group =
          createGroup();

        const items = [
          createItem(),
        ];

        vi.mocked(
          aggregationService.findByAggregationId,
        ).mockResolvedValue(
          group,
        );

        vi.mocked(
          aggregationService.getItems,
        ).mockResolvedValue(
          items,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.getExpiredSnapshot(
            group.aggregationId,
            group.windowEnd,
          );

        expect(
          result,
        ).toEqual({
          group,
          items,
        });
      },
    );

    it(
      'finds expired groups and loads their items',
      async () => {
        const aggregationService =
          createServiceMock();

        const firstGroup =
          createGroup({
            aggregationId:
              'aggregation-001',
          });

        const secondGroup =
          createGroup({
            aggregationId:
              'aggregation-002',
          });

        const firstItems = [
          createItem({
            itemId:
              'item-001',

            aggregationId:
              firstGroup.aggregationId,
          }),
        ];

        const secondItems = [
          createItem({
            itemId:
              'item-002',

            aggregationId:
              secondGroup.aggregationId,

            sourceEventId:
              'event-002',

            orderingKey:
              '0000001724839320000|event-002',
          }),
        ];

        vi.mocked(
          aggregationService.findExpiredGroups,
        ).mockResolvedValue([
          firstGroup,
          secondGroup,
        ]);

        vi.mocked(
          aggregationService.getItems,
        )
          .mockResolvedValueOnce(
            firstItems,
          )
          .mockResolvedValueOnce(
            secondItems,
          );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const now =
          new Date(
            '2026-08-28T11:00:00.000Z',
          );

        const result =
          await service.findExpiredSnapshots(
            now,
          );

        expect(
          result,
        ).toEqual([
          {
            group:
              firstGroup,

            items:
              firstItems,
          },

          {
            group:
              secondGroup,

            items:
              secondItems,
          },
        ]);

        expect(
          aggregationService.findExpiredGroups,
        ).toHaveBeenCalledWith(
          now,
        );

        expect(
          aggregationService.getItems,
        ).toHaveBeenNthCalledWith(
          1,

          firstGroup.aggregationId,
        );

        expect(
          aggregationService.getItems,
        ).toHaveBeenNthCalledWith(
          2,

          secondGroup.aggregationId,
        );
      },
    );

    it(
      'returns an empty snapshot list when there are no expired groups',
      async () => {
        const aggregationService =
          createServiceMock();

        vi.mocked(
          aggregationService.findExpiredGroups,
        ).mockResolvedValue(
          [],
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.findExpiredSnapshots(
            new Date(
              '2026-08-28T11:00:00.000Z',
            ),
          );

        expect(
          result,
        ).toEqual([]);

        expect(
          aggregationService.getItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'delegates atomic expired aggregation claiming',
      async () => {
        const aggregationService =
          createServiceMock();

        const group =
          createGroup({
            status:
              'FLUSHING',
          });

        const now =
          new Date(
            '2026-08-28T10:10:00.000Z',
          );

        vi.mocked(
          aggregationService.claimExpiredForFlushing,
        ).mockResolvedValue(
          group,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.claimExpiredForFlushing(
            group.aggregationId,
            now,
          );

        expect(
          result,
        ).toBe(group);

        expect(
          aggregationService.claimExpiredForFlushing,
        ).toHaveBeenCalledWith(
          group.aggregationId,
          now,
        );
      },
    );

    it(
      'returns null when atomic expired aggregation claiming fails',
      async () => {
        const aggregationService =
          createServiceMock();

        const now =
          new Date(
            '2026-08-28T10:10:00.000Z',
          );

        vi.mocked(
          aggregationService.claimExpiredForFlushing,
        ).mockResolvedValue(
          null,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.claimExpiredForFlushing(
            'aggregation-test-001',
            now,
          );

        expect(
          result,
        ).toBeNull();

        expect(
          aggregationService.claimExpiredForFlushing,
        ).toHaveBeenCalledWith(
          'aggregation-test-001',
          now,
        );
      },
    );

    it(
      'delegates markFlushed',
      async () => {
        const aggregationService =
          createServiceMock();

        const group =
          createGroup({
            status:
              'FLUSHED',
          });

        vi.mocked(
          aggregationService.markFlushed,
        ).mockResolvedValue(
          group,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.markFlushed(
            group.aggregationId,
          );

        expect(
          result,
        ).toBe(group);

        expect(
          aggregationService.markFlushed,
        ).toHaveBeenCalledWith(
          group.aggregationId,
        );
      },
    );

    it(
      'delegates markFailed',
      async () => {
        const aggregationService =
          createServiceMock();

        const group =
          createGroup({
            status:
              'FAILED',
          });

        vi.mocked(
          aggregationService.markFailed,
        ).mockResolvedValue(
          group,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.markFailed(
            group.aggregationId,
          );

        expect(
          result,
        ).toBe(group);

        expect(
          aggregationService.markFailed,
        ).toHaveBeenCalledWith(
          group.aggregationId,
        );
      },
    );

    it(
      'returns items through the flush service',
      async () => {
        const aggregationService =
          createServiceMock();

        const items = [
          createItem(),
        ];

        vi.mocked(
          aggregationService.getItems,
        ).mockResolvedValue(
          items,
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const result =
          await service.getItems(
            'aggregation-test-001',
          );

        expect(
          result,
        ).toEqual(items);

        expect(
          aggregationService.getItems,
        ).toHaveBeenCalledWith(
          'aggregation-test-001',
        );
      },
    );

    it(
      'rejects an empty aggregation ID',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.getExpiredSnapshot(
            '   ',
          ),
        ).rejects.toThrow(
          'aggregationId must be non-empty.',
        );

        expect(
          aggregationService.findByAggregationId,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an invalid aggregation ID type at runtime',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.getExpiredSnapshot(
            null as unknown as string,
          ),
        ).rejects.toThrow(
          'aggregationId must be non-empty.',
        );
      },
    );

    it(
      'rejects an invalid now date',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.getExpiredSnapshot(
            'aggregation-test-001',

            new Date(
              'invalid',
            ),
          ),
        ).rejects.toThrow(
          'now must be a valid Date.',
        );

        expect(
          aggregationService.findByAggregationId,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'uses the supplied current time when finding expired snapshots',
      async () => {
        const aggregationService =
          createServiceMock();

        vi.mocked(
          aggregationService.findExpiredGroups,
        ).mockResolvedValue(
          [],
        );

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        const now =
          new Date(
            '2026-08-28T12:30:00.000Z',
          );

        await service.findExpiredSnapshots(
          now,
        );

        expect(
          aggregationService.findExpiredGroups,
        ).toHaveBeenCalledWith(
          now,
        );
      },
    );

    it(
      'rejects an invalid aggregation ID when claiming',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.claimExpiredForFlushing(
            '   ',
            new Date(
              '2026-08-28T10:10:00.000Z',
            ),
          ),
        ).rejects.toThrow(
          'aggregationId must be non-empty.',
        );

        expect(
          aggregationService.claimExpiredForFlushing,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an invalid now date when claiming',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.claimExpiredForFlushing(
            'aggregation-test-001',

            new Date(
              'invalid',
            ),
          ),
        ).rejects.toThrow(
          'now must be a valid Date.',
        );

        expect(
          aggregationService.claimExpiredForFlushing,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an invalid aggregation ID when loading items',
      async () => {
        const aggregationService =
          createServiceMock();

        const service =
          new NotificationAggregationFlushService(
            aggregationService,
          );

        await expect(
          service.getItems(
            '   ',
          ),
        ).rejects.toThrow(
          'aggregationId must be non-empty.',
        );

        expect(
          aggregationService.getItems,
        ).not.toHaveBeenCalled();
      },
    );
  },
);