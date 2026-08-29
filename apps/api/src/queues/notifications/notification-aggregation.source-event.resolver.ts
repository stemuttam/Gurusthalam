import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

import type {
  NotificationJobData,
  NotificationJsonValue,
} from './notification.types.js';

export interface NotificationAggregationSourceEvent {
  readonly sourceEventId: string;

  readonly notificationId: string;

  readonly data: NotificationJobData;
}

/**
 * Resolves aggregation source events from the existing
 * notification/outbox pipeline.
 *
 * Aggregation items intentionally store only sourceEventId.
 *
 * The existing Notification record identifies the notification,
 * while the transactional OutboxEvent payload contains the
 * NotificationJobData required to reproduce the original
 * notification semantics.
 */
@Injectable()
export class NotificationAggregationSourceEventResolver {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolves one aggregation source event.
   *
   * sourceEventId identifies the original notificationId.
   */
  async resolve(
    sourceEventId: string,
  ): Promise<NotificationAggregationSourceEvent> {
    const normalizedSourceEventId =
      this.normalizeSourceEventId(
        sourceEventId,
      );

    const notification =
      await this.prisma.notification.findUnique({
        where: {
          notificationId:
            normalizedSourceEventId,
        },

        select: {
          id: true,

          notificationId: true,
        },
      });

    if (
      notification === null
    ) {
      throw new NotFoundException(
        `Notification source event "${normalizedSourceEventId}" was not found.`,
      );
    }

    /*
     * NotificationQueueService stores the original
     * NotificationJobData in the transactional outbox payload.
     *
     * The notification's internal database ID is used as the
     * OutboxEvent aggregateId.
     */
    const outbox =
      await this.prisma.outboxEvent.findFirst({
        where: {
          aggregateType:
            'Notification',

          aggregateId:
            notification.id,

          eventType:
            'notification.enqueue',
        },

        orderBy: {
          createdAt:
            'asc',
        },
      });

    if (
      outbox === null
    ) {
      throw new NotFoundException(
        `Notification outbox payload for source event "${normalizedSourceEventId}" was not found.`,
      );
    }

    const data =
      this.parseNotificationJobData(
        outbox.payload,
        normalizedSourceEventId,
      );

    return {
      sourceEventId:
        normalizedSourceEventId,

      notificationId:
        notification.notificationId,

      data,
    };
  }

  /**
   * Resolves multiple source events while preserving the
   * supplied deterministic ordering.
   *
   * Duplicate source-event IDs are rejected because an
   * aggregation item represents one persisted source event.
   */
  async resolveMany(
    sourceEventIds: readonly string[],
  ): Promise<
    NotificationAggregationSourceEvent[]
  > {
    const normalizedIds =
      sourceEventIds.map(
        (
          sourceEventId,
        ) =>
          this.normalizeSourceEventId(
            sourceEventId,
          ),
      );

    const uniqueIds =
      new Set(
        normalizedIds,
      );

    if (
      uniqueIds.size !==
      normalizedIds.length
    ) {
      throw new BadRequestException(
        'sourceEventIds must not contain duplicates.',
      );
    }

    const results:
      NotificationAggregationSourceEvent[] =
      [];

    for (
      const sourceEventId of
        normalizedIds
    ) {
      results.push(
        await this.resolve(
          sourceEventId,
        ),
      );
    }

    return results;
  }

  /**
   * Validates and normalizes a source-event identifier.
   */
  private normalizeSourceEventId(
    sourceEventId: string,
  ): string {
    if (
      typeof sourceEventId !==
        'string' ||
      sourceEventId.trim().length ===
        0
    ) {
      throw new BadRequestException(
        'sourceEventId must be non-empty.',
      );
    }

    return sourceEventId.trim();
  }

  /**
   * Parses and validates the persisted outbox payload.
   *
   * Objects are constructed immutably because NotificationJobData
   * and NotificationRecipient expose readonly properties.
   */
  private parseNotificationJobData(
    payload: unknown,
    sourceEventId: string,
  ): NotificationJobData {
    if (
      payload === null ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      throw new Error(
        `Invalid notification outbox payload for source event "${sourceEventId}".`,
      );
    }

    const value =
      payload as Record<
        string,
        unknown
      >;

    const notificationId =
      this.requireString(
        value.notificationId,
        'notificationId',
        sourceEventId,
      );

    const channel =
      this.requireChannel(
        value.channel,
        sourceEventId,
      );

    const recipient =
      this.parseRecipient(
        value.recipient,
        sourceEventId,
      );

    const body =
      this.requireString(
        value.body,
        'body',
        sourceEventId,
      );

    const idempotencyKey =
      this.requireString(
        value.idempotencyKey,
        'idempotencyKey',
        sourceEventId,
      );

    return {
      notificationId,

      channel,

      recipient,

      body,

      idempotencyKey,

      ...(value.subject !==
      undefined
        ? {
            subject:
              this.requireString(
                value.subject,
                'subject',
                sourceEventId,
              ),
          }
        : {}),

      ...(value.title !==
      undefined
        ? {
            title:
              this.requireString(
                value.title,
                'title',
                sourceEventId,
              ),
          }
        : {}),

      ...(value.template !==
      undefined
        ? {
            template:
              this.requireString(
                value.template,
                'template',
                sourceEventId,
              ),
          }
        : {}),

      ...(value.templateData !==
      undefined
        ? {
            templateData:
              this.parseTemplateData(
                value.templateData,
                sourceEventId,
              ),
          }
        : {}),
    };
  }

  /**
   * Parses and validates a notification recipient.
   *
   * The returned object is constructed in one operation so
   * readonly properties are never mutated after creation.
   */
  private parseRecipient(
    value: unknown,
    sourceEventId: string,
  ): NotificationJobData['recipient'] {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new Error(
        `Invalid notification recipient in source event "${sourceEventId}".`,
      );
    }

    const recipient =
      value as Record<
        string,
        unknown
      >;

    const userId =
      this.requireString(
        recipient.userId,
        'recipient.userId',
        sourceEventId,
      );

    let deviceTokens:
      | readonly string[]
      | undefined;

    if (
      recipient.deviceTokens !==
      undefined
    ) {
      if (
        !Array.isArray(
          recipient.deviceTokens,
        )
      ) {
        throw new Error(
          `Invalid recipient.deviceTokens in source event "${sourceEventId}".`,
        );
      }

      deviceTokens =
        recipient.deviceTokens.map(
          (
            token,
          ) =>
            this.requireString(
              token,
              'recipient.deviceTokens[]',
              sourceEventId,
            ),
        );
    }

    return {
      userId,

      ...(recipient.email !==
      undefined
        ? {
            email:
              this.requireString(
                recipient.email,
                'recipient.email',
                sourceEventId,
              ),
          }
        : {}),

      ...(deviceTokens !==
      undefined
        ? {
            deviceTokens,
          }
        : {}),
    };
  }

  /**
   * Parses template data from the persisted JSON payload.
   */
  private parseTemplateData(
    value: unknown,
    sourceEventId: string,
  ): {
    [key: string]:
      NotificationJsonValue;
  } {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new Error(
        `Invalid templateData in source event "${sourceEventId}".`,
      );
    }

    return value as {
      [key: string]:
        NotificationJsonValue;
    };
  }

  /**
   * Requires a non-empty string from the persisted payload.
   */
  private requireString(
    value: unknown,
    field: string,
    sourceEventId: string,
  ): string {
    if (
      typeof value !==
        'string' ||
      value.trim().length ===
        0
    ) {
      throw new Error(
        `Invalid ${field} in notification outbox payload for source event "${sourceEventId}".`,
      );
    }

    return value.trim();
  }

  /**
   * Validates the notification channel.
   */
  private requireChannel(
    value: unknown,
    sourceEventId: string,
  ): NotificationJobData['channel'] {
    switch (
      value
    ) {
      case 'email':
      case 'in-app':
      case 'push':
        return value;

      default:
        throw new Error(
          `Invalid notification channel in source event "${sourceEventId}".`,
        );
    }
  }
}