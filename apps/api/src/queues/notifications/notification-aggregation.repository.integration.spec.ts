import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../../database/prisma/prisma.service.js';

import { NotificationAggregationRepository } from './notification-aggregation.repository.js';

import {
  createNotificationAggregationGroupIdentity,
} from './notification-aggregation.policy.js';

describe(
  'NotificationAggregationRepository - PostgreSQL integration',
  () => {
    const prisma = new PrismaService();

    const repository =
      new NotificationAggregationRepository(prisma);

    beforeAll(async () => {
      await prisma.onModuleInit();
    });

    beforeEach(async () => {
      await prisma.notificationAggregationItem.deleteMany();

      await prisma.notificationAggregation.deleteMany();
    });

    afterAll(async () => {
      await prisma.onModuleDestroy();
    });

    function createIdentity(
      channel:
        | 'email'
        | 'in-app'
        | 'push',
    ) {
      const now = new Date();

      return createNotificationAggregationGroupIdentity({
        userId:
          `integration-user-${randomUUID()}`,

        channel,

        category:
          'course.activity',

        aggregationKey:
          `course-${randomUUID()}`,

        locale:
          'en-IN',

        sourceEventId:
          `event-${randomUUID()}`,

        occurredAt:
          now,
      });
    }

    async function createGroup(
      channel:
        | 'email'
        | 'in-app'
        | 'push',
    ) {
      const now = new Date();

      const identity =
        createIdentity(channel);

      return repository.createGroupIfAbsent({
        aggregationId:
          randomUUID(),

        identity,

        windowStart:
          now,

        windowEnd:
          new Date(
            now.getTime() + 300_000,
          ),
      });
    }

    it(
      'creates and retrieves an aggregation group',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'email',

            category:
              'course.activity',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        const group =
          await repository.createGroupIfAbsent({
            aggregationId:
              randomUUID(),

            identity,

            windowStart:
              now,

            windowEnd:
              new Date(
                now.getTime() + 300_000,
              ),
          });

        const persisted =
          await repository.findByGroupKey(
            identity.groupKey,
          );

        expect(
          persisted,
        ).not.toBeNull();

        expect(
          persisted?.aggregationId,
        ).toBe(
          group.aggregationId,
        );

        expect(
          persisted?.groupKey,
        ).toBe(
          identity.groupKey,
        );

        expect(
          persisted?.channel,
        ).toBe('email');

        expect(
          persisted?.itemCount,
        ).toBe(0);
      },
    );

    it(
      'does not create duplicate groups for the same deterministic group key',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'push',

            category:
              'learning.reminder',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        const first =
          await repository.createGroupIfAbsent({
            aggregationId:
              randomUUID(),

            identity,

            windowStart:
              now,

            windowEnd:
              new Date(
                now.getTime() + 300_000,
              ),
          });

        const second =
          await repository.createGroupIfAbsent({
            aggregationId:
              randomUUID(),

            identity,

            windowStart:
              now,

            windowEnd:
              new Date(
                now.getTime() + 300_000,
              ),
          });

        expect(
          second.aggregationId,
        ).toBe(
          first.aggregationId,
        );

        const count =
          await prisma.notificationAggregation.count({
            where: {
              groupKey:
                identity.groupKey,
            },
          });

        expect(count).toBe(1);
      },
    );

    it(
      'persists a source event exactly once',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'in-app',

            category:
              'course.activity',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        const group =
          await repository.createGroupIfAbsent({
            aggregationId:
              randomUUID(),

            identity,

            windowStart:
              now,

            windowEnd:
              new Date(
                now.getTime() + 300_000,
              ),
          });

        const sourceEventId =
          `source-${randomUUID()}`;

        const itemId =
          randomUUID();

        const orderingKey =
          `0000000000000001|${sourceEventId}`;

        const first =
          await repository.addItem({
            aggregationId:
              group.aggregationId,

            itemId,

            sourceEventId,

            occurredAt:
              now,

            orderingKey,
          });

        const second =
          await repository.addItem({
            aggregationId:
              group.aggregationId,

            itemId:
              randomUUID(),

            sourceEventId,

            occurredAt:
              now,

            orderingKey,
          });

        expect(
          first.inserted,
        ).toBe(true);

        expect(
          second.inserted,
        ).toBe(false);

        expect(
          first.item?.sourceEventId,
        ).toBe(
          sourceEventId,
        );

        expect(
          second.item?.sourceEventId,
        ).toBe(
          sourceEventId,
        );

        expect(
          second.item?.itemId,
        ).toBe(
          first.item?.itemId,
        );

        const count =
          await repository.getItemCount(
            group.aggregationId,
          );

        expect(count).toBe(1);

        const persistedGroup =
          await repository.findByAggregationId(
            group.aggregationId,
          );

        expect(
          persistedGroup?.itemCount,
        ).toBe(1);
      },
    );

    it(
      'returns aggregation items in deterministic ordering order',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'email',

            category:
              'course.activity',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        const group =
          await repository.createGroupIfAbsent({
            aggregationId:
              randomUUID(),

            identity,

            windowStart:
              now,

            windowEnd:
              new Date(
                now.getTime() + 300_000,
              ),
          });

        await repository.addItem({
          aggregationId:
            group.aggregationId,

          itemId:
            randomUUID(),

          sourceEventId:
            'event-b',

          occurredAt:
            new Date(
              now.getTime() + 2_000,
            ),

          orderingKey:
            '0000000000000002|event-b',
        });

        await repository.addItem({
          aggregationId:
            group.aggregationId,

          itemId:
            randomUUID(),

          sourceEventId:
            'event-a',

          occurredAt:
            now,

          orderingKey:
            '0000000000000001|event-a',
        });

        const items =
          await repository.listItems(
            group.aggregationId,
          );

        expect(
          items.map(
            (item) =>
              item.sourceEventId,
          ),
        ).toEqual([
          'event-a',
          'event-b',
        ]);

        expect(
          items.map(
            (item) =>
              item.orderingKey,
          ),
        ).toEqual([
          '0000000000000001|event-a',
          '0000000000000002|event-b',
        ]);
      },
    );

    it(
      'updates aggregation status',
      async () => {
        const group =
          await createGroup(
            'email',
          );

        const updated =
          await repository.updateStatus(
            group.aggregationId,
            'FLUSHING',
          );

        expect(
          updated.status,
        ).toBe('FLUSHING');

        const persisted =
          await repository.findByAggregationId(
            group.aggregationId,
          );

        expect(
          persisted?.status,
        ).toBe('FLUSHING');
      },
    );

    it(
      'finds open groups whose aggregation window has expired',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'push',

            category:
              'learning.reminder',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        await repository.createGroupIfAbsent({
          aggregationId:
            randomUUID(),

          identity,

          windowStart:
            new Date(
              now.getTime() - 600_000,
            ),

          windowEnd:
            new Date(
              now.getTime() - 300_000,
            ),
        });

        const expired =
          await repository.findOpenExpiredGroups(
            now,
          );

        expect(
          expired.some(
            (group) =>
              group.groupKey ===
              identity.groupKey,
          ),
        ).toBe(true);
      },
    );

    it(
      'does not return non-expired open groups',
      async () => {
        const now = new Date();

        const identity =
          createNotificationAggregationGroupIdentity({
            userId:
              `integration-user-${randomUUID()}`,

            channel:
              'email',

            category:
              'course.activity',

            aggregationKey:
              `course-${randomUUID()}`,

            locale:
              'en-IN',

            sourceEventId:
              `event-${randomUUID()}`,

            occurredAt:
              now,
          });

        await repository.createGroupIfAbsent({
          aggregationId:
            randomUUID(),

          identity,

          windowStart:
            now,

          windowEnd:
            new Date(
              now.getTime() + 300_000,
            ),
        });

        const expired =
          await repository.findOpenExpiredGroups(
            now,
          );

        expect(
          expired.some(
            (group) =>
              group.groupKey ===
              identity.groupKey,
          ),
        ).toBe(false);
      },
    );
  },
);