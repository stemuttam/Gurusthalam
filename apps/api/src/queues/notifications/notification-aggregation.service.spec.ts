import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationAggregationPolicy,
} from './notification-aggregation.policy.js';

import {
  NotificationAggregationService,
} from './notification-aggregation.service.js';

import type {
  NotificationAggregationRepositoryGroup,
  NotificationAggregationRepositoryItem,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationRequest,
} from './notification-aggregation.types.js';

interface MockRepository {
  createGroupIfAbsent: ReturnType<typeof vi.fn>;
  addItem: ReturnType<typeof vi.fn>;
  findByAggregationId: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  listItems: ReturnType<typeof vi.fn>;
  getItemCount: ReturnType<typeof vi.fn>;
  findOpenExpiredGroups: ReturnType<typeof vi.fn>;
}

function createRepository(): MockRepository {
  return {
    createGroupIfAbsent: vi.fn(),
    addItem: vi.fn(),
    findByAggregationId: vi.fn(),
    updateStatus: vi.fn(),
    listItems: vi.fn(),
    getItemCount: vi.fn(),
    findOpenExpiredGroups: vi.fn(),
  };
}

function createRequest(
  overrides: Partial<NotificationAggregationRequest> = {},
): NotificationAggregationRequest {
  return {
    userId: 'user-001',
    channel: 'email',
    category: 'course.activity',
    aggregationKey: 'course-001',
    locale: 'en-IN',
    sourceEventId: 'event-001',
    occurredAt: new Date(
      '2026-08-26T09:00:00.000Z',
    ),
    ...overrides,
  };
}

function createGroup(
  overrides: Partial<NotificationAggregationRepositoryGroup> = {},
): NotificationAggregationRepositoryGroup {
  const createdAt = new Date(
    '2026-08-26T09:00:00.000Z',
  );

  return {
    aggregationId: 'aggregation-001',
    groupKey:
      'user-001|email|course.activity|course-001|en-IN',
    userId: 'user-001',
    channel: 'email',
    category: 'course.activity',
    aggregationKey: 'course-001',
    locale: 'en-IN',
    status: 'OPEN',
    windowStart: createdAt,
    windowEnd: new Date(
      '2026-08-26T09:05:00.000Z',
    ),
    itemCount: 0,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createItem(
  overrides: Partial<NotificationAggregationRepositoryItem> = {},
): NotificationAggregationRepositoryItem {
  return {
    itemId: 'item-001',
    aggregationId: 'aggregation-001',
    sourceEventId: 'event-001',
    occurredAt: new Date(
      '2026-08-26T09:00:00.000Z',
    ),
    orderingKey:
      '0001756198800000|event-001',
    createdAt: new Date(
      '2026-08-26T09:00:01.000Z',
    ),
    ...overrides,
  };
}

describe(
  'NotificationAggregationService',
  () => {
    it(
      'creates or retrieves a group using the validated request and policy window',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 50,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const group =
          createGroup();

        repository.createGroupIfAbsent
          .mockResolvedValue(group);

        await expect(
          service.getOrCreateGroup(
            request,
          ),
        ).resolves.toEqual(
          group,
        );

        expect(
          repository.createGroupIfAbsent,
        ).toHaveBeenCalledTimes(1);

        expect(
          repository.createGroupIfAbsent,
        ).toHaveBeenCalledWith({
          aggregationId:
            expect.stringMatching(
              /^aggregation-[0-9a-f]{8}$/,
            ),
          identity: {
            userId: 'user-001',
            channel: 'email',
            category: 'course.activity',
            aggregationKey: 'course-001',
            locale: 'en-IN',
            groupKey:
              'user-001|email|course.activity|course-001|en-IN',
          },
          windowStart:
            request.occurredAt,
          windowEnd:
            new Date(
              '2026-08-26T09:05:00.000Z',
            ),
        });
      },
    );

    it(
      'adds a new event and returns the refreshed group',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 50,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const initialGroup =
          createGroup({
            itemCount: 0,
          });

        const insertedItem =
          createItem();

        const updatedGroup =
          createGroup({
            itemCount: 1,
          });

        repository.createGroupIfAbsent
          .mockResolvedValue(
            initialGroup,
          );

        repository.addItem
          .mockResolvedValue({
            inserted: true,
            item: insertedItem,
          });

        repository.findByAggregationId
          .mockResolvedValue(
            updatedGroup,
          );

        await expect(
          service.addEvent(
            request,
          ),
        ).resolves.toEqual({
          group: updatedGroup,
          item: insertedItem,
          inserted: true,
          shouldFlush: false,
          reason: 'added',
        });

        expect(
          repository.addItem,
        ).toHaveBeenCalledTimes(1);

        expect(
          repository.addItem,
        ).toHaveBeenCalledWith({
          aggregationId:
            initialGroup.aggregationId,
          itemId:
            expect.any(String),
          sourceEventId:
            request.sourceEventId,
          occurredAt:
            request.occurredAt,
          orderingKey:
            policy.createOrderingKey(
              request,
            ),
        });

        expect(
          repository.findByAggregationId,
        ).toHaveBeenCalledWith(
          initialGroup.aggregationId,
        );
      },
    );

    it(
      'returns duplicate when the repository reports an existing source event',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 50,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const group =
          createGroup();

        const existingItem =
          createItem();

        repository.createGroupIfAbsent
          .mockResolvedValue(group);

        repository.addItem
          .mockResolvedValue({
            inserted: false,
            item: existingItem,
          });

        await expect(
          service.addEvent(
            request,
          ),
        ).resolves.toEqual({
          group,
          item: existingItem,
          inserted: false,
          shouldFlush: false,
          reason: 'duplicate',
        });

        expect(
          repository.findByAggregationId,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'flushes when the aggregation window has expired',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 50,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const windowStart =
          new Date(
            '2026-08-26T09:00:00.000Z',
          );

        const request =
          createRequest({
            occurredAt:
              new Date(
                '2026-08-26T09:05:00.000Z',
              ),
          });

        const group =
          createGroup({
            windowStart,
            windowEnd:
              new Date(
                '2026-08-26T09:05:00.000Z',
              ),
          });

        repository.createGroupIfAbsent
          .mockResolvedValue(group);

        await expect(
          service.addEvent(
            request,
          ),
        ).resolves.toEqual({
          group,
          item: null,
          inserted: false,
          shouldFlush: true,
          reason: 'window-expired',
        });

        expect(
          repository.addItem,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'flushes when the maximum item count has been reached',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 2,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const group =
          createGroup({
            itemCount: 2,
          });

        repository.createGroupIfAbsent
          .mockResolvedValue(group);

        await expect(
          service.addEvent(
            request,
          ),
        ).resolves.toEqual({
          group,
          item: null,
          inserted: false,
          shouldFlush: true,
          reason: 'maximum-items',
        });

        expect(
          repository.addItem,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'requests a flush immediately after inserting the maximum allowed item',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy({
            maximumItems: 2,
            windowSeconds: 300,
          });

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const initialGroup =
          createGroup({
            itemCount: 1,
          });

        const insertedItem =
          createItem();

        const updatedGroup =
          createGroup({
            itemCount: 2,
          });

        repository.createGroupIfAbsent
          .mockResolvedValue(
            initialGroup,
          );

        repository.addItem
          .mockResolvedValue({
            inserted: true,
            item: insertedItem,
          });

        repository.findByAggregationId
          .mockResolvedValue(
            updatedGroup,
          );

        await expect(
          service.addEvent(
            request,
          ),
        ).resolves.toEqual({
          group: updatedGroup,
          item: insertedItem,
          inserted: true,
          shouldFlush: true,
          reason: 'maximum-items',
        });
      },
    );

    it(
      'throws when the aggregation group disappears after insertion',
      async () => {
        const repository =
          createRepository();

        const policy =
          new NotificationAggregationPolicy();

        const service =
          new NotificationAggregationService(
            repository as never,
            policy,
          );

        const request =
          createRequest();

        const group =
          createGroup();

        const item =
          createItem();

        repository.createGroupIfAbsent
          .mockResolvedValue(group);

        repository.addItem
          .mockResolvedValue({
            inserted: true,
            item,
          });

        repository.findByAggregationId
          .mockResolvedValue(null);

        await expect(
          service.addEvent(
            request,
          ),
        ).rejects.toThrow(
          'Notification aggregation "aggregation-001" disappeared after item insertion.',
        );
      },
    );

    it(
      'delegates markFlushing to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const group =
          createGroup({
            status: 'FLUSHING',
          });

        repository.updateStatus
          .mockResolvedValue(group);

        await expect(
          service.markFlushing(
            'aggregation-001',
          ),
        ).resolves.toEqual(group);

        expect(
          repository.updateStatus,
        ).toHaveBeenCalledWith(
          'aggregation-001',
          'FLUSHING',
        );
      },
    );

    it(
      'delegates markFlushed to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const group =
          createGroup({
            status: 'FLUSHED',
          });

        repository.updateStatus
          .mockResolvedValue(group);

        await expect(
          service.markFlushed(
            'aggregation-001',
          ),
        ).resolves.toEqual(group);

        expect(
          repository.updateStatus,
        ).toHaveBeenCalledWith(
          'aggregation-001',
          'FLUSHED',
        );
      },
    );

    it(
      'delegates markFailed to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const group =
          createGroup({
            status: 'FAILED',
          });

        repository.updateStatus
          .mockResolvedValue(group);

        await expect(
          service.markFailed(
            'aggregation-001',
          ),
        ).resolves.toEqual(group);

        expect(
          repository.updateStatus,
        ).toHaveBeenCalledWith(
          'aggregation-001',
          'FAILED',
        );
      },
    );

    it(
      'delegates getItems to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const items = [
          createItem(),
          createItem({
            itemId: 'item-002',
            sourceEventId: 'event-002',
          }),
        ];

        repository.listItems
          .mockResolvedValue(items);

        await expect(
          service.getItems(
            'aggregation-001',
          ),
        ).resolves.toEqual(items);

        expect(
          repository.listItems,
        ).toHaveBeenCalledWith(
          'aggregation-001',
        );
      },
    );

    it(
      'delegates getItemCount to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        repository.getItemCount
          .mockResolvedValue(3);

        await expect(
          service.getItemCount(
            'aggregation-001',
          ),
        ).resolves.toBe(3);

        expect(
          repository.getItemCount,
        ).toHaveBeenCalledWith(
          'aggregation-001',
        );
      },
    );

    it(
      'delegates findExpiredGroups to the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const now =
          new Date(
            '2026-08-26T10:00:00.000Z',
          );

        const groups = [
          createGroup({
            windowEnd:
              new Date(
                '2026-08-26T09:05:00.000Z',
              ),
          }),
        ];

        repository.findOpenExpiredGroups
          .mockResolvedValue(groups);

        await expect(
          service.findExpiredGroups(
            now,
          ),
        ).resolves.toEqual(groups);

        expect(
          repository.findOpenExpiredGroups,
        ).toHaveBeenCalledWith(now);
      },
    );

    it(
      'uses the current time when findExpiredGroups receives no explicit time',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        repository.findOpenExpiredGroups
          .mockResolvedValue([]);

        const before =
          Date.now();

        await expect(
          service.findExpiredGroups(),
        ).resolves.toEqual([]);

        const after =
          Date.now();

        expect(
          repository.findOpenExpiredGroups,
        ).toHaveBeenCalledTimes(1);

        const [actualNow] =
          repository.findOpenExpiredGroups
            .mock.calls[0] as [Date];

        expect(
          actualNow,
        ).toBeInstanceOf(Date);

        expect(
          actualNow.getTime(),
        ).toBeGreaterThanOrEqual(
          before,
        );

        expect(
          actualNow.getTime(),
        ).toBeLessThanOrEqual(
          after,
        );
      },
    );

    it(
      'rejects an invalid aggregation request before calling the repository',
      async () => {
        const repository =
          createRepository();

        const service =
          new NotificationAggregationService(
            repository as never,
          );

        const request =
          createRequest({
            userId: '   ',
          });

        await expect(
          service.getOrCreateGroup(
            request,
          ),
        ).rejects.toThrow(
          'userId must be non-empty.',
        );

        expect(
          repository.createGroupIfAbsent,
        ).not.toHaveBeenCalled();

        expect(
          repository.addItem,
        ).not.toHaveBeenCalled();
      },
    );
  },
);