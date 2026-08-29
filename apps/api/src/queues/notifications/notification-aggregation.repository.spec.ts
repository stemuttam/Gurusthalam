import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationAggregationRepository,
} from './notification-aggregation.repository.js';

import type {
  NotificationAggregationGroupIdentity,
} from './notification-aggregation.types.js';

interface MockPrismaClient {
  notificationAggregation: {
    findUnique?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    upsert?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    findMany?: ReturnType<typeof vi.fn>;
  };

  notificationAggregationItem?: {
    createMany?: ReturnType<typeof vi.fn>;
    findFirst?: ReturnType<typeof vi.fn>;
    findUnique?: ReturnType<typeof vi.fn>;
    findUniqueOrThrow?: ReturnType<typeof vi.fn>;
    findMany?: ReturnType<typeof vi.fn>;
    count?: ReturnType<typeof vi.fn>;
  };

  $transaction?: ReturnType<typeof vi.fn>;
}

function createRepository(
  prisma: MockPrismaClient,
): NotificationAggregationRepository {
  return new NotificationAggregationRepository(
    prisma as never,
  );
}

function createIdentity(): NotificationAggregationGroupIdentity {
  return {
    userId: 'user-001',
    channel: 'email',
    category: 'course.activity',
    aggregationKey: 'course-001',
    locale: 'en-IN',
    groupKey:
      'user-001|email|course.activity|course-001|en-IN',
  };
}

/**
 * `id` represents the actual PostgreSQL primary key used internally
 * by NotificationAggregationItem.
 *
 * `aggregationId` is the public/deterministic aggregation identifier
 * exposed by the repository.
 */
function createGroup() {
  const createdAt = new Date(
    '2026-08-26T09:00:00.000Z',
  );

  return {
    id: 'db-aggregation-001',

    aggregationId:
      'aggregation-001',

    groupKey:
      'user-001|email|course.activity|course-001|en-IN',

    userId: 'user-001',

    channel: 'EMAIL' as const,

    category: 'course.activity',

    aggregationKey: 'course-001',

    locale: 'en-IN',

    status: 'OPEN' as const,

    windowStart: createdAt,

    windowEnd: new Date(
      '2026-08-26T09:05:00.000Z',
    ),

    itemCount: 0,

    createdAt,

    updatedAt: createdAt,
  };
}

function createItem() {
  return {
    id: 'item-001',

    aggregationId:
      'db-aggregation-001',

    sourceEventId: 'event-001',

    occurredAt: new Date(
      '2026-08-26T09:00:00.000Z',
    ),

    orderingKey:
      '1756198800000|event-001',

    createdAt: new Date(
      '2026-08-26T09:00:01.000Z',
    ),
  };
}

describe(
  'NotificationAggregationRepository',
  () => {
    it(
      'finds an aggregation group by deterministic group key',
      async () => {
        const persisted = createGroup();

        const findUnique = vi
          .fn()
          .mockResolvedValue(persisted);

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findUnique,
          },
        };

        const repository =
          createRepository(prisma);

        await expect(
          repository.findByGroupKey(
            persisted.groupKey,
          ),
        ).resolves.toEqual({
          aggregationId:
            persisted.aggregationId,

          groupKey:
            persisted.groupKey,

          userId:
            persisted.userId,

          channel: 'email',

          category:
            persisted.category,

          aggregationKey:
            persisted.aggregationKey,

          locale:
            persisted.locale,

          status: 'OPEN',

          windowStart:
            persisted.windowStart,

          windowEnd:
            persisted.windowEnd,

          itemCount: 0,

          createdAt:
            persisted.createdAt,

          updatedAt:
            persisted.updatedAt,
        });

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            groupKey:
              persisted.groupKey,
          },
        });
      },
    );

    it(
      'returns null when the aggregation group does not exist',
      async () => {
        const findUnique = vi
          .fn()
          .mockResolvedValue(null);

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findUnique,
          },
        };

        const repository =
          createRepository(prisma);

        await expect(
          repository.findByGroupKey(
            'missing-group',
          ),
        ).resolves.toBeNull();

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            groupKey: 'missing-group',
          },
        });
      },
    );

    it(
      'finds an aggregation group by aggregation id',
      async () => {
        const persisted = createGroup();

        const findUnique = vi
          .fn()
          .mockResolvedValue(persisted);

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findUnique,
          },
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.findByAggregationId(
            persisted.aggregationId,
          );

        expect(result).toEqual({
          aggregationId:
            persisted.aggregationId,

          groupKey:
            persisted.groupKey,

          userId:
            persisted.userId,

          channel: 'email',

          category:
            persisted.category,

          aggregationKey:
            persisted.aggregationKey,

          locale:
            persisted.locale,

          status: 'OPEN',

          windowStart:
            persisted.windowStart,

          windowEnd:
            persisted.windowEnd,

          itemCount: 0,

          createdAt:
            persisted.createdAt,

          updatedAt:
            persisted.updatedAt,
        });

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            aggregationId:
              persisted.aggregationId,
          },
        });
      },
    );

    it(
      'creates a new aggregation group',
      async () => {
        const persisted = createGroup();

        const identity =
          createIdentity();

        const create = vi
          .fn()
          .mockResolvedValue(
            persisted,
          );

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            create,
          },
        };

        const repository =
          createRepository(prisma);

        const windowStart =
          persisted.windowStart;

        const windowEnd =
          persisted.windowEnd;

        const result =
          await repository.createGroup({
            aggregationId:
              persisted.aggregationId,

            identity,

            windowStart,

            windowEnd,
          });

        expect(
          result.aggregationId,
        ).toBe(
          persisted.aggregationId,
        );

        expect(
          result.channel,
        ).toBe('email');

        expect(create).toHaveBeenCalledWith({
          data: {
            aggregationId:
              persisted.aggregationId,

            groupKey:
              identity.groupKey,

            userId:
              identity.userId,

            channel: 'EMAIL',

            category:
              identity.category,

            aggregationKey:
              identity.aggregationKey,

            locale:
              identity.locale,

            status: 'OPEN',

            windowStart,

            windowEnd,

            itemCount: 0,
          },
        });
      },
    );

    it(
      'uses an idempotent upsert for group creation',
      async () => {
        const persisted =
          createGroup();

        const identity =
          createIdentity();

        const upsert = vi
          .fn()
          .mockResolvedValue(
            persisted,
          );

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            upsert,
          },
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.createGroupIfAbsent({
            aggregationId:
              persisted.aggregationId,

            identity,

            windowStart:
              persisted.windowStart,

            windowEnd:
              persisted.windowEnd,
          });

        expect(
          result.groupKey,
        ).toBe(
          persisted.groupKey,
        );

        expect(
          upsert,
        ).toHaveBeenCalledOnce();

        expect(
          upsert,
        ).toHaveBeenCalledWith({
          where: {
            groupKey:
              identity.groupKey,
          },

          create: {
            aggregationId:
              persisted.aggregationId,

            groupKey:
              identity.groupKey,

            userId:
              identity.userId,

            channel: 'EMAIL',

            category:
              identity.category,

            aggregationKey:
              identity.aggregationKey,

            locale:
              identity.locale,

            status: 'OPEN',

            windowStart:
              persisted.windowStart,

            windowEnd:
              persisted.windowEnd,

            itemCount: 0,
          },

          update: {},
        });
      },
    );

    it(
      'returns the existing item when the source event is duplicated',
      async () => {
        const group =
          createGroup();

        const existing =
          createItem();

        const createMany = vi
          .fn()
          .mockResolvedValue({
            count: 0,
          });

        /*
         * The repository uses findFirst() after createMany()
         * reports that no row was inserted. This resolves the
         * already-persisted item for an idempotent duplicate event.
         */
        const findFirstItem = vi
          .fn()
          .mockResolvedValue(
            existing,
          );

        /*
         * The repository resolves the public aggregationId
         * to the actual NotificationAggregation database id before
         * operating on NotificationAggregationItem.
         */
        const findUniqueAggregation =
          vi
            .fn()
            .mockResolvedValue(
              group,
            );

        const transaction = {
          notificationAggregation: {
            findUnique:
              findUniqueAggregation,
          },

          notificationAggregationItem: {
            createMany,

            findFirst:
              findFirstItem,
          },
        };

        const prisma: MockPrismaClient = {
          notificationAggregation: {},

          notificationAggregationItem: {},

          $transaction: vi
            .fn()
            .mockImplementation(
              async (
                callback: (
                  client:
                    typeof transaction,
                ) => Promise<unknown>,
              ) =>
                callback(transaction),
            ),
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.addItem({
            aggregationId:
              group.aggregationId,

            itemId: 'item-002',

            sourceEventId:
              existing.sourceEventId,

            occurredAt:
              existing.occurredAt,

            orderingKey:
              existing.orderingKey,
          });

        expect(result).toEqual({
          inserted: false,

          item: {
            itemId:
              existing.id,

            aggregationId:
              group.aggregationId,

            sourceEventId:
              existing.sourceEventId,

            occurredAt:
              existing.occurredAt,

            orderingKey:
              existing.orderingKey,

            createdAt:
              existing.createdAt,
          },
        });

        expect(
          findUniqueAggregation,
        ).toHaveBeenCalled();

        expect(
          createMany,
        ).toHaveBeenCalledOnce();

        expect(
          findFirstItem,
        ).toHaveBeenCalledWith({
          where: {
            aggregationId:
              group.id,

            sourceEventId:
              existing.sourceEventId,
          },
        });
      },
    );

    it(
      'increments the group item count when a new item is inserted',
      async () => {
        const group =
          createGroup();

        const item =
          createItem();

        const createMany = vi
          .fn()
          .mockResolvedValue({
            count: 1,
          });

        const findUniqueAggregation =
          vi
            .fn()
            .mockResolvedValue(
              group,
            );

        const findUniqueOrThrow =
          vi
            .fn()
            .mockResolvedValue(
              item,
            );

        const update = vi
          .fn()
          .mockResolvedValue({
            ...group,
            itemCount: 1,
          });

        const transaction = {
          notificationAggregation: {
            findUnique:
              findUniqueAggregation,

            update,
          },

          notificationAggregationItem: {
            createMany,

            findUniqueOrThrow,
          },
        };

        const prisma: MockPrismaClient = {
          notificationAggregation: {},

          notificationAggregationItem: {},

          $transaction: vi
            .fn()
            .mockImplementation(
              async (
                callback: (
                  client:
                    typeof transaction,
                ) => Promise<unknown>,
              ) =>
                callback(transaction),
            ),
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.addItem({
            aggregationId:
              group.aggregationId,

            itemId:
              item.id,

            sourceEventId:
              item.sourceEventId,

            occurredAt:
              item.occurredAt,

            orderingKey:
              item.orderingKey,
          });

        expect(
          result.inserted,
        ).toBe(true);

        expect(
          result.item?.itemId,
        ).toBe(
          item.id,
        );

        expect(
          findUniqueAggregation,
        ).toHaveBeenCalled();

        expect(
          createMany,
        ).toHaveBeenCalledOnce();

        expect(
          findUniqueOrThrow,
        ).toHaveBeenCalled();

        /*
         * The repository updates the actual database primary key,
         * not the public aggregationId.
         */
        expect(
          update,
        ).toHaveBeenCalledWith({
          where: {
            id: group.id,
          },

          data: {
            itemCount: {
              increment: 1,
            },
          },
        });
      },
    );

    it(
      'lists aggregation items in deterministic ordering',
      async () => {
        const group =
          createGroup();

        const first = {
          ...createItem(),

          id: 'item-a',

          sourceEventId:
            'event-a',

          aggregationId:
            group.id,

          orderingKey:
            '0000000000000001|event-a',
        };

        const second = {
          ...createItem(),

          id: 'item-b',

          sourceEventId:
            'event-b',

          aggregationId:
            group.id,

          orderingKey:
            '0000000000000002|event-b',
        };

        const findUniqueAggregation =
          vi
            .fn()
            .mockResolvedValue(
              group,
            );

        const findMany = vi
          .fn()
          .mockResolvedValue([
            first,
            second,
          ]);

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findUnique:
              findUniqueAggregation,
          },

          notificationAggregationItem: {
            findMany,
          },
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.listItems(
            group.aggregationId,
          );

        expect(
          result.map(
            (item) =>
              item.sourceEventId,
          ),
        ).toEqual([
          'event-a',
          'event-b',
        ]);

        expect(
          findUniqueAggregation,
        ).toHaveBeenCalled();

        expect(
          findMany,
        ).toHaveBeenCalledWith({
          where: {
            aggregationId:
              group.id,
          },

          orderBy: [
            {
              orderingKey: 'asc',
            },

            {
              id: 'asc',
            },
          ],
        });
      },
    );

    it(
      'returns the persisted item count',
      async () => {
        const group =
          createGroup();

        const count = vi
          .fn()
          .mockResolvedValue(3);

        const findUniqueAggregation =
          vi
            .fn()
            .mockResolvedValue(
              group,
            );

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findUnique:
              findUniqueAggregation,
          },

          notificationAggregationItem: {
            count,
          },
        };

        const repository =
          createRepository(prisma);

        await expect(
          repository.getItemCount(
            group.aggregationId,
          ),
        ).resolves.toBe(3);

        expect(
          findUniqueAggregation,
        ).toHaveBeenCalled();

        expect(
          count,
        ).toHaveBeenCalledWith({
          where: {
            aggregationId:
              group.id,
          },
        });
      },
    );

    it(
      'updates aggregation status',
      async () => {
        const persisted = {
          ...createGroup(),

          status:
            'FLUSHING' as const,
        };

        const update = vi
          .fn()
          .mockResolvedValue(
            persisted,
          );

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            update,
          },
        };

        const repository =
          createRepository(prisma);

        const result =
          await repository.updateStatus(
            'aggregation-001',
            'FLUSHING',
          );

        expect(
          result.status,
        ).toBe('FLUSHING');

        expect(
          update,
        ).toHaveBeenCalledWith({
          where: {
            aggregationId:
              'aggregation-001',
          },

          data: {
            status: 'FLUSHING',
          },
        });
      },
    );

    it(
      'finds only open groups whose windows have expired',
      async () => {
        const expired = {
          ...createGroup(),

          windowEnd: new Date(
            '2026-08-26T09:04:00.000Z',
          ),
        };

        const findMany = vi
          .fn()
          .mockResolvedValue([
            expired,
          ]);

        const prisma: MockPrismaClient = {
          notificationAggregation: {
            findMany,
          },
        };

        const repository =
          createRepository(prisma);

        const now = new Date(
          '2026-08-26T09:05:00.000Z',
        );

        const result =
          await repository.findOpenExpiredGroups(
            now,
          );

        expect(
          result,
        ).toHaveLength(1);

        expect(
          result[0]?.aggregationId,
        ).toBe(
          expired.aggregationId,
        );

        expect(
          findMany,
        ).toHaveBeenCalledWith({
          where: {
            status: 'OPEN',

            windowEnd: {
              lte: now,
            },
          },

          orderBy: [
            {
              windowEnd: 'asc',
            },

            {
              createdAt: 'asc',
            },

            {
              aggregationId: 'asc',
            },
          ],
        });
      },
    );
  },
);