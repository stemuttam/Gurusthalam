import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

export interface NotificationReconciliationOptions {
  readonly staleAfterSeconds?:
    number;

  readonly limit?:
    number;
}

export interface NotificationReconciliationAudit {
  readonly scannedDeliveries:
    number;

  readonly staleProcessingDeliveries:
    number;

  readonly processingWithoutAttemptTimestamp:
    number;

  readonly sentNotificationsWithoutSentDelivery:
    number;

  readonly failedNotificationsWithoutFailedDelivery:
    number;

  readonly retryingNotificationsWithoutActiveOutbox:
    number;

  readonly queuedNotificationsWithoutOutbox:
    number;

  readonly healthyNotifications:
    number;

  readonly anomalies:
    readonly NotificationReconciliationAnomaly[];
}

export interface NotificationReconciliationAnomaly {
  readonly notificationId:
    string;

  readonly type:
    | 'STALE_PROCESSING_DELIVERY'
    | 'PROCESSING_WITHOUT_ATTEMPT_TIMESTAMP'
    | 'SENT_WITHOUT_SENT_DELIVERY'
    | 'FAILED_WITHOUT_FAILED_DELIVERY'
    | 'RETRYING_WITHOUT_ACTIVE_OUTBOX'
    | 'QUEUED_WITHOUT_OUTBOX';

  readonly deliveryKey:
    string | null;

  readonly details:
    string;
}

export interface NotificationReconciliationRecoveryResult {
  readonly scanned:
    number;

  readonly recovered:
    number;

  readonly cutoff:
    string;

  readonly deliveryIds:
    readonly string[];
}

const DEFAULT_STALE_AFTER_SECONDS =
  300;

const DEFAULT_LIMIT =
  500;

const MAX_LIMIT =
  5000;

@Injectable()
export class NotificationReconciliationService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async audit(
    options:
      NotificationReconciliationOptions = {},
  ): Promise<NotificationReconciliationAudit> {
    const staleAfterSeconds =
      this.normalizeStaleAfterSeconds(
        options.staleAfterSeconds,
      );

    const limit =
      this.normalizeLimit(
        options.limit,
      );

    const cutoff =
      new Date(
        Date.now() -
          staleAfterSeconds *
            1000,
      );

    /*
     * ------------------------------------------------------------
     * Find stale PROCESSING deliveries
     * ------------------------------------------------------------
     *
     * A delivery is considered stale when:
     *
     * 1. it is PROCESSING and has an old lastAttemptAt, or
     * 2. it is PROCESSING, has never recorded lastAttemptAt,
     *    and its createdAt is already outside the threshold.
     */
    const deliveries =
      await this.prisma.notificationDelivery.findMany({
        where: {
          OR: [
            {
              status:
                'PROCESSING',

              lastAttemptAt: {
                lt:
                  cutoff,
              },
            },

            {
              status:
                'PROCESSING',

              lastAttemptAt:
                null,

              createdAt: {
                lt:
                  cutoff,
              },
            },
          ],
        },

        select: {
          id:
            true,

          notificationId:
            true,

          deliveryKey:
            true,

          status:
            true,

          lastAttemptAt:
            true,

          createdAt:
            true,
        },

        orderBy: {
          createdAt:
            'asc',
        },

        take:
          limit,
      });

    const staleProcessingDeliveries =
      deliveries.filter(
        (
          delivery,
        ) =>
          delivery.status ===
          'PROCESSING',
      );

    const processingWithoutAttemptTimestamp =
      staleProcessingDeliveries.filter(
        (
          delivery,
        ) =>
          delivery.lastAttemptAt ===
          null,
      );

    /*
     * ------------------------------------------------------------
     * Delivery-level anomalies
     * ------------------------------------------------------------
     */
    const anomalies:
      NotificationReconciliationAnomaly[] =
      [];

    for (
      const delivery of deliveries
    ) {
      anomalies.push({
        notificationId:
          delivery.notificationId,

        type:
          delivery.lastAttemptAt ===
          null
            ? 'PROCESSING_WITHOUT_ATTEMPT_TIMESTAMP'
            : 'STALE_PROCESSING_DELIVERY',

        deliveryKey:
          delivery.deliveryKey,

        details:
          delivery.lastAttemptAt ===
          null
            ? `Delivery ${delivery.deliveryKey} has remained PROCESSING without a lastAttemptAt before the ${staleAfterSeconds}-second stale threshold.`
            : `Delivery ${delivery.deliveryKey} has remained PROCESSING since ${delivery.lastAttemptAt.toISOString()}.`,
      });
    }

    /*
     * ------------------------------------------------------------
     * Parent Notification integrity audit
     * ------------------------------------------------------------
     *
     * We separately inspect business-level notification state
     * against its delivery state and active notification outbox.
     */
    let sentNotificationsWithoutSentDelivery =
      0;

    let failedNotificationsWithoutFailedDelivery =
      0;

    let retryingNotificationsWithoutActiveOutbox =
      0;

    let queuedNotificationsWithoutOutbox =
      0;

    let healthyNotifications =
      0;

    const auditCandidates =
      await this.prisma.notification.findMany({
        where: {
          status: {
            in: [
              'QUEUED',
              'RETRYING',
              'SENT',
              'FAILED',
            ],
          },
        },

        select: {
          notificationId:
            true,

          status:
            true,

          deliveries: {
            select: {
              status:
                true,
            },
          },
        },

        orderBy: {
          createdAt:
            'asc',
        },

        take:
          limit,
      });

    const auditNotificationIds =
      auditCandidates.map(
        (
          notification,
        ) =>
          notification.notificationId,
      );

    /*
     * Map database notification IDs to the logical notification IDs
     * used by the notification domain.
     */
    const activeOutboxByAggregate =
      new Map<
        string,
        number
      >();

    if (
      auditNotificationIds.length >
      0
    ) {
      const auditNotifications =
        await this.prisma.notification.findMany({
          where: {
            notificationId: {
              in:
                auditNotificationIds,
            },
          },

          select: {
            id:
              true,

            notificationId:
              true,
          },
        });

      const aggregateIds =
        auditNotifications.map(
          (
            notification,
          ) =>
            notification.id,
        );

      if (
        aggregateIds.length >
        0
      ) {
        const activeOutbox =
          await this.prisma.outboxEvent.groupBy({
            by: [
              'aggregateId',
            ],

            where: {
              aggregateType:
                'Notification',

              aggregateId: {
                in:
                  aggregateIds,
              },

              eventType:
                'notification.enqueue',

              status: {
                in: [
                  'PENDING',
                  'PROCESSING',
                ],
              },
            },

            _count: {
              _all:
                true,
            },
          });

        for (
          const item of activeOutbox
        ) {
          activeOutboxByAggregate.set(
            item.aggregateId,
            item._count._all,
          );
        }
      }

      for (
        const notification of auditNotifications
      ) {
        const source =
          auditCandidates.find(
            (
              candidate,
            ) =>
              candidate.notificationId ===
              notification.notificationId,
          );

        if (
          !source
        ) {
          continue;
        }

        const sentDeliveries =
          source.deliveries.filter(
            (
              delivery,
            ) =>
              delivery.status ===
              'SENT',
          ).length;

        const failedDeliveries =
          source.deliveries.filter(
            (
              delivery,
            ) =>
              delivery.status ===
              'FAILED',
          ).length;

        const activeOutboxCount =
          activeOutboxByAggregate.get(
            notification.id,
          ) ??
          0;

        /*
         * SENT notification must have at least one SENT delivery.
         */
        if (
          source.status ===
            'SENT' &&
          sentDeliveries ===
            0
        ) {
          sentNotificationsWithoutSentDelivery +=
            1;

          anomalies.push({
            notificationId:
              notification.notificationId,

            type:
              'SENT_WITHOUT_SENT_DELIVERY',

            deliveryKey:
              null,

            details:
              `Notification ${notification.notificationId} is SENT but has no SENT NotificationDelivery.`,
          });

          continue;
        }

        /*
         * FAILED notification should have delivery-level evidence
         * of a failed attempt.
         */
        if (
          source.status ===
            'FAILED' &&
          failedDeliveries ===
            0
        ) {
          failedNotificationsWithoutFailedDelivery +=
            1;

          anomalies.push({
            notificationId:
              notification.notificationId,

            type:
              'FAILED_WITHOUT_FAILED_DELIVERY',

            deliveryKey:
              null,

            details:
              `Notification ${notification.notificationId} is FAILED but has no FAILED NotificationDelivery.`,
          });

          continue;
        }

        /*
         * RETRYING must have an active enqueue outbox operation.
         */
        if (
          source.status ===
            'RETRYING' &&
          activeOutboxCount ===
            0
        ) {
          retryingNotificationsWithoutActiveOutbox +=
            1;

          anomalies.push({
            notificationId:
              notification.notificationId,

            type:
              'RETRYING_WITHOUT_ACTIVE_OUTBOX',

            deliveryKey:
              null,

            details:
              `Notification ${notification.notificationId} is RETRYING but has no active notification enqueue outbox event.`,
          });

          continue;
        }

        /*
         * QUEUED must have an active enqueue outbox operation.
         */
        if (
          source.status ===
            'QUEUED' &&
          activeOutboxCount ===
            0
        ) {
          queuedNotificationsWithoutOutbox +=
            1;

          anomalies.push({
            notificationId:
              notification.notificationId,

            type:
              'QUEUED_WITHOUT_OUTBOX',

            deliveryKey:
              null,

            details:
              `Notification ${notification.notificationId} is QUEUED but has no active notification enqueue outbox event.`,
          });

          continue;
        }

        /*
         * PROCESSING is intentionally not counted as healthy here.
         * A PROCESSING notification requires delivery-level
         * reconciliation rather than a simplistic healthy label.
         */
        if (
          source.status !==
          'PROCESSING'
        ) {
          healthyNotifications +=
            1;
        }
      }
    }

    /*
     * A stale delivery is already represented by the first query.
     * Remove those delivery-level anomalies from the healthy count
     * rather than treating their parent state as fully healthy.
     */
    const healthy =
      Math.max(
        0,
        healthyNotifications -
          anomalies.filter(
            (
              anomaly,
            ) =>
              anomaly.type ===
                'STALE_PROCESSING_DELIVERY' ||
              anomaly.type ===
                'PROCESSING_WITHOUT_ATTEMPT_TIMESTAMP',
          ).length,
      );

    return {
      scannedDeliveries:
        deliveries.length,

      staleProcessingDeliveries:
        staleProcessingDeliveries.length,

      processingWithoutAttemptTimestamp:
        processingWithoutAttemptTimestamp.length,

      sentNotificationsWithoutSentDelivery,

      failedNotificationsWithoutFailedDelivery,

      retryingNotificationsWithoutActiveOutbox,

      queuedNotificationsWithoutOutbox,

      healthyNotifications:
        healthy,

      anomalies,
    };
  }

  async recoverStaleProcessing(
    options:
      NotificationReconciliationOptions = {},
  ): Promise<NotificationReconciliationRecoveryResult> {
    const staleAfterSeconds =
      this.normalizeStaleAfterSeconds(
        options.staleAfterSeconds,
      );

    const cutoff =
      new Date(
        Date.now() -
          staleAfterSeconds *
            1000,
      );

    /*
     * Only PROCESSING deliveries may be recovered.
     *
     * The status is checked again during updateMany so a delivery
     * that changes state between SELECT and UPDATE cannot be
     * accidentally overwritten.
     */
    const stale =
      await this.prisma.notificationDelivery.findMany({
        where: {
          status:
            'PROCESSING',

          OR: [
            {
              lastAttemptAt: {
                lt:
                  cutoff,
              },
            },

            {
              lastAttemptAt:
                null,

              createdAt: {
                lt:
                  cutoff,
              },
            },
          ],
        },

        select: {
          id:
            true,
        },

        orderBy: {
          createdAt:
            'asc',
        },

        take:
          this.normalizeLimit(
            options.limit,
          ),
      });

    if (
      stale.length ===
      0
    ) {
      return {
        scanned:
          0,

        recovered:
          0,

        cutoff:
          cutoff.toISOString(),

        deliveryIds:
          [],
      };
    }

    const deliveryIds =
      stale.map(
        (
          delivery,
        ) =>
          delivery.id,
      );

    const recoveryReason =
      `Recovered stale PROCESSING delivery after ${staleAfterSeconds} seconds.`;

    const updated =
      await this.prisma.notificationDelivery.updateMany({
        where: {
          id: {
            in:
              deliveryIds,
          },

          status:
            'PROCESSING',
        },

        data: {
          status:
            'FAILED',

          failedAt:
            new Date(),

          failureReason:
            recoveryReason,
        },
      });

    return {
      scanned:
        stale.length,

      recovered:
        updated.count,

      cutoff:
        cutoff.toISOString(),

      deliveryIds,
    };
  }

  private normalizeStaleAfterSeconds(
    value:
      number | undefined,
  ): number {
    if (
      value ===
        undefined ||
      !Number.isFinite(
        value,
      ) ||
      value <=
        0
    ) {
      return DEFAULT_STALE_AFTER_SECONDS;
    }

    return Math.min(
      Math.floor(
        value,
      ),
      24 * 60 * 60,
    );
  }

  private normalizeLimit(
    value:
      number | undefined,
  ): number {
    if (
      value ===
        undefined ||
      !Number.isFinite(
        value,
      ) ||
      value <=
        0
    ) {
      return DEFAULT_LIMIT;
    }

    return Math.min(
      Math.floor(
        value,
      ),
      MAX_LIMIT,
    );
  }
}