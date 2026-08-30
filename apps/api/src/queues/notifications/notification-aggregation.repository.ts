import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import type {
  NotificationAggregationChannel,
  NotificationAggregationGroupIdentity,
} from './notification-aggregation.types.js';

export type NotificationAggregationStatus =
  | 'OPEN'
  | 'FLUSHING'
  | 'FLUSHED'
  | 'FAILED';

export interface NotificationAggregationRepositoryGroup {
  readonly aggregationId: string;
  readonly groupKey: string;
  readonly userId: string;
  readonly channel: NotificationAggregationChannel;
  readonly category: string;
  readonly aggregationKey: string;
  readonly locale: string;
  readonly status: NotificationAggregationStatus;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly itemCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NotificationAggregationRepositoryItem {
  readonly itemId: string;
  readonly aggregationId: string;
  readonly sourceEventId: string;
  readonly occurredAt: Date;
  readonly orderingKey: string;
  readonly createdAt: Date;
}

export interface CreateNotificationAggregationGroupInput {
  readonly aggregationId: string;
  readonly identity: NotificationAggregationGroupIdentity;
  readonly windowStart: Date;
  readonly windowEnd: Date;
}

export interface AddNotificationAggregationItemInput {
  readonly aggregationId: string;
  readonly itemId: string;
  readonly sourceEventId: string;
  readonly occurredAt: Date;
  readonly orderingKey: string;
}

export interface AddNotificationAggregationItemResult {
  readonly inserted: boolean;
  readonly item:
    | NotificationAggregationRepositoryItem
    | null;
}

type PersistedAggregationChannel =
  | 'EMAIL'
  | 'IN_APP'
  | 'PUSH';

interface PersistedAggregationGroup {
  readonly aggregationId: string;
  readonly groupKey: string;
  readonly userId: string;
  readonly channel: PersistedAggregationChannel;
  readonly category: string;
  readonly aggregationKey: string;
  readonly locale: string;
  readonly status: NotificationAggregationStatus;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly itemCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toPrismaChannel(
  channel: NotificationAggregationChannel,
): PersistedAggregationChannel {
  switch (channel) {
    case 'email':
      return 'EMAIL';

    case 'in-app':
      return 'IN_APP';

    case 'push':
      return 'PUSH';

    default:
      throw new Error(
        `Unsupported notification aggregation channel "${String(channel)}".`,
      );
  }
}

function fromPrismaChannel(
  channel: PersistedAggregationChannel,
): NotificationAggregationChannel {
  switch (channel) {
    case 'EMAIL':
      return 'email';

    case 'IN_APP':
      return 'in-app';

    case 'PUSH':
      return 'push';

    default:
      throw new Error(
        `Unsupported persisted notification aggregation channel "${String(channel)}".`,
      );
  }
}

function fromPersistedStatus(
  status: NotificationAggregationStatus,
): NotificationAggregationStatus {
  switch (status) {
    case 'OPEN':
    case 'FLUSHING':
    case 'FLUSHED':
    case 'FAILED':
      return status;

    default:
      throw new Error(
        `Unsupported persisted notification aggregation status "${String(status)}".`,
      );
  }
}

function toRepositoryGroup(
  group: PersistedAggregationGroup,
): NotificationAggregationRepositoryGroup {
  return {
    aggregationId:
      group.aggregationId,

    groupKey:
      group.groupKey,

    userId:
      group.userId,

    channel:
      fromPrismaChannel(
        group.channel,
      ),

    category:
      group.category,

    aggregationKey:
      group.aggregationKey,

    locale:
      group.locale,

    status:
      fromPersistedStatus(
        group.status,
      ),

    windowStart:
      group.windowStart,

    windowEnd:
      group.windowEnd,

    itemCount:
      group.itemCount,

    createdAt:
      group.createdAt,

    updatedAt:
      group.updatedAt,
  };
}

@Injectable()
export class NotificationAggregationRepository {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async findByGroupKey(
    groupKey: string,
  ): Promise<
    NotificationAggregationRepositoryGroup | null
  > {
    const group =
      await this.prisma.notificationAggregation.findUnique({
        where: {
          groupKey,
        },
      });

    return group === null
      ? null
      : toRepositoryGroup(
          group,
        );
  }

  async findByAggregationId(
    aggregationId: string,
  ): Promise<
    NotificationAggregationRepositoryGroup | null
  > {
    const group =
      await this.prisma.notificationAggregation.findUnique({
        where: {
          aggregationId,
        },
      });

    return group === null
      ? null
      : toRepositoryGroup(
          group,
        );
  }

  async createGroup(
    input:
      CreateNotificationAggregationGroupInput,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    const group =
      await this.prisma.notificationAggregation.create({
        data: {
          aggregationId:
            input.aggregationId,

          groupKey:
            input.identity.groupKey,

          userId:
            input.identity.userId,

          channel:
            toPrismaChannel(
              input.identity.channel,
            ),

          category:
            input.identity.category,

          aggregationKey:
            input.identity.aggregationKey,

          locale:
            input.identity.locale,

          status:
            'OPEN',

          windowStart:
            input.windowStart,

          windowEnd:
            input.windowEnd,

          itemCount:
            0,
        },
      });

    return toRepositoryGroup(
      group,
    );
  }

  async createGroupIfAbsent(
    input:
      CreateNotificationAggregationGroupInput,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    const group =
      await this.prisma.notificationAggregation.upsert({
        where: {
          groupKey:
            input.identity.groupKey,
        },

        create: {
          aggregationId:
            input.aggregationId,

          groupKey:
            input.identity.groupKey,

          userId:
            input.identity.userId,

          channel:
            toPrismaChannel(
              input.identity.channel,
            ),

          category:
            input.identity.category,

          aggregationKey:
            input.identity.aggregationKey,

          locale:
            input.identity.locale,

          status:
            'OPEN',

          windowStart:
            input.windowStart,

          windowEnd:
            input.windowEnd,

          itemCount:
            0,
        },

        update: {},
      });

    return toRepositoryGroup(
      group,
    );
  }

  /**
   * Adds an item to an aggregation group exactly once.
   *
   * NotificationAggregation.aggregationId is the public
   * application-level identifier.
   *
   * NotificationAggregationItem.aggregationId references
   * the internal NotificationAggregation.id primary key.
   */
  async addItem(
    input:
      AddNotificationAggregationItemInput,
  ): Promise<
    AddNotificationAggregationItemResult
  > {
    return this.prisma.$transaction(
      async (
        transaction,
      ) => {
        const aggregation =
          await transaction.notificationAggregation.findUnique({
            where: {
              aggregationId:
                input.aggregationId,
            },

            select: {
              id: true,
            },
          });

        if (
          aggregation === null
        ) {
          throw new Error(
            `Notification aggregation "${input.aggregationId}" was not found.`,
          );
        }

        const result =
          await transaction.notificationAggregationItem.createMany({
            data: {
              id:
                input.itemId,

              aggregationId:
                aggregation.id,

              sourceEventId:
                input.sourceEventId,

              occurredAt:
                input.occurredAt,

              orderingKey:
                input.orderingKey,
            },

            skipDuplicates:
              true,
          });

        if (
          result.count === 0
        ) {
          const existing =
            await transaction.notificationAggregationItem.findFirst({
              where: {
                aggregationId:
                  aggregation.id,

                sourceEventId:
                  input.sourceEventId,
              },
            });

          if (
            existing === null
          ) {
            return {
              inserted:
                false,

              item:
                null,
            };
          }

          return {
            inserted:
              false,

            item: {
              itemId:
                existing.id,

              aggregationId:
                input.aggregationId,

              sourceEventId:
                existing.sourceEventId,

              occurredAt:
                existing.occurredAt,

              orderingKey:
                existing.orderingKey,

              createdAt:
                existing.createdAt,
            },
          };
        }

        const item =
          await transaction.notificationAggregationItem.findUniqueOrThrow({
            where: {
              id:
                input.itemId,
            },
          });

        await transaction.notificationAggregation.update({
          where: {
            id:
              aggregation.id,
          },

          data: {
            itemCount: {
              increment:
                1,
            },
          },
        });

        return {
          inserted:
            true,

          item: {
            itemId:
              item.id,

            aggregationId:
              input.aggregationId,

            sourceEventId:
              item.sourceEventId,

            occurredAt:
              item.occurredAt,

            orderingKey:
              item.orderingKey,

            createdAt:
              item.createdAt,
          },
        };
      },
    );
  }

  async listItems(
    aggregationId: string,
  ): Promise<
    NotificationAggregationRepositoryItem[]
  > {
    const aggregation =
      await this.prisma.notificationAggregation.findUnique({
        where: {
          aggregationId,
        },

        select: {
          id: true,
        },
      });

    if (
      aggregation === null
    ) {
      return [];
    }

    const items =
      await this.prisma.notificationAggregationItem.findMany({
        where: {
          aggregationId:
            aggregation.id,
        },

        orderBy: [
          {
            orderingKey:
              'asc',
          },

          {
            id:
              'asc',
          },
        ],
      });

    return items.map(
      (
        item,
      ) => ({
        itemId:
          item.id,

        aggregationId,

        sourceEventId:
          item.sourceEventId,

        occurredAt:
          item.occurredAt,

        orderingKey:
          item.orderingKey,

        createdAt:
          item.createdAt,
      }),
    );
  }

  async getItemCount(
    aggregationId: string,
  ): Promise<number> {
    const aggregation =
      await this.prisma.notificationAggregation.findUnique({
        where: {
          aggregationId,
        },

        select: {
          id: true,
        },
      });

    if (
      aggregation === null
    ) {
      return 0;
    }

    return this.prisma.notificationAggregationItem.count({
      where: {
        aggregationId:
          aggregation.id,
      },
    });
  }

  /**
   * Atomically claims an expired OPEN aggregation.
   *
   * Exactly one concurrent caller can transition the same
   * aggregation from OPEN to FLUSHING.
   *
   * The database conditional UPDATE is the authoritative
   * concurrency boundary.
   *
   * Returns the claimed group when this caller successfully
   * changed OPEN -> FLUSHING.
   *
   * Returns null when:
   *
   * - the aggregation does not exist;
   * - it is no longer OPEN;
   * - its window has not expired; or
   * - another concurrent caller already claimed it.
   */
  async claimExpiredForFlushing(
    aggregationId: string,
    now: Date,
  ): Promise<
    NotificationAggregationRepositoryGroup | null
  > {
    const result =
      await this.prisma.notificationAggregation.updateMany({
        where: {
          aggregationId,

          status:
            'OPEN',

          windowEnd: {
            lte:
              now,
          },
        },

        data: {
          status:
            'FLUSHING',
        },
      });

    if (
      result.count !== 1
    ) {
      return null;
    }

    const claimed =
      await this.prisma.notificationAggregation.findUnique({
        where: {
          aggregationId,
        },
      });

    if (
      claimed === null
    ) {
      throw new Error(
        `Notification aggregation "${aggregationId}" disappeared after being claimed.`,
      );
    }

    return toRepositoryGroup(
      claimed,
    );
  }

  async updateStatus(
    aggregationId: string,
    status:
      NotificationAggregationStatus,
  ): Promise<
    NotificationAggregationRepositoryGroup
  > {
    const group =
      await this.prisma.notificationAggregation.update({
        where: {
          aggregationId,
        },

        data: {
          status,
        },
      });

    return toRepositoryGroup(
      group,
    );
  }

  async findOpenExpiredGroups(
    now: Date,
  ): Promise<
    NotificationAggregationRepositoryGroup[]
  > {
    const groups =
      await this.prisma.notificationAggregation.findMany({
        where: {
          status:
            'OPEN',

          windowEnd: {
            lte:
              now,
          },
        },

        orderBy: [
          {
            windowEnd:
              'asc',
          },

          {
            createdAt:
              'asc',
          },

          {
            aggregationId:
              'asc',
          },
        ],
      });

    return groups.map(
      toRepositoryGroup,
    );
  }
}