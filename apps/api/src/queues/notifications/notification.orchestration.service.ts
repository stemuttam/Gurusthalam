import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  NotificationQueueService,
  type NotificationEnqueueOptions,
  type NotificationEnqueueResult,
} from './notification.queue.js';

import {
  assertNotificationChannelIdentity,
} from './notification-channel-identity.js';

import type {
  NotificationJobData,
} from './notification.types.js';

export interface NotificationOrchestrationChildResult
  extends NotificationEnqueueResult {
  readonly channel:
    NotificationJobData['channel'];
}

export interface NotificationOrchestrationResult {
  readonly orchestrationId:
    string;

  readonly notificationId:
    string;

  readonly accepted:
    true;

  readonly action:
    'fan-out-scheduled';

  readonly channels:
    readonly NotificationOrchestrationChildResult[];
}

@Injectable()
export class NotificationOrchestrationService {
  constructor(
    private readonly queue:
      NotificationQueueService,
  ) {}

  async fanOut(
    orchestrationId:
      string,

    notifications:
      readonly NotificationJobData[],

    options:
      NotificationEnqueueOptions =
        {},
  ):
    Promise<NotificationOrchestrationResult> {
    const logicalId =
      orchestrationId.trim();

    if (
      logicalId.length ===
      0
    ) {
      throw new BadRequestException(
        'orchestrationId must be non-empty.',
      );
    }

    if (
      notifications.length ===
      0
    ) {
      return {
        orchestrationId:
          logicalId,

        notificationId:
          logicalId,

        accepted:
          true,

        action:
          'fan-out-scheduled',

        channels:
          [],
      };
    }

    this.validateFanOutIdentities(
      logicalId,

      notifications,
    );

    const results =
      await Promise.all(
        notifications.map(
          async (
            notification,
          ) => {
            const result =
              await this.queue.enqueue(
                notification,

                options,
              );

            return {
              ...result,

              channel:
                notification.channel,
            };
          },
        ),
      );

    return {
      orchestrationId:
        logicalId,

      notificationId:
        logicalId,

      accepted:
        true,

      action:
        'fan-out-scheduled',

      channels:
        results,
    };
  }

  private validateFanOutIdentities(
    orchestrationId:
      string,

    notifications:
      readonly NotificationJobData[],
  ):
    void {
    const channelSet =
      new Set<
        NotificationJobData['channel']
      >();

    const notificationIdSet =
      new Set<
        string
      >();

    const idempotencyKeySet =
      new Set<
        string
      >();

    const logicalKey =
      this.deriveLogicalIdempotencyKey(
        notifications,
      );

    for (
      const notification of
        notifications
    ) {
      if (
        channelSet.has(
          notification.channel,
        )
      ) {
        throw new BadRequestException(
          `Duplicate channel "${notification.channel}" in notification fan-out.`,
        );
      }

      channelSet.add(
        notification.channel,
      );

      if (
        notificationIdSet.has(
          notification.notificationId,
        )
      ) {
        throw new BadRequestException(
          `Duplicate notificationId "${notification.notificationId}" in notification fan-out.`,
        );
      }

      notificationIdSet.add(
        notification.notificationId,
      );

      if (
        idempotencyKeySet.has(
          notification.idempotencyKey,
        )
      ) {
        throw new BadRequestException(
          `Duplicate idempotencyKey "${notification.idempotencyKey}" in notification fan-out.`,
        );
      }

      idempotencyKeySet.add(
        notification.idempotencyKey,
      );

      try {
        assertNotificationChannelIdentity(
          orchestrationId,

          logicalKey,

          notification,
        );
      } catch (
        error: unknown
      ) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
        );
      }
    }
  }

  private deriveLogicalIdempotencyKey(
    notifications:
      readonly NotificationJobData[],
  ):
    string {
    const first =
      notifications[0];

    if (
      first ===
      undefined
    ) {
      throw new BadRequestException(
        'Notification fan-out requires at least one channel.',
      );
    }

    const suffix =
      `:${first.channel}`;

    if (
      !first.idempotencyKey.endsWith(
        suffix,
      )
    ) {
      throw new BadRequestException(
        `Invalid idempotency identity "${first.idempotencyKey}" for channel "${first.channel}".`,
      );
    }

    return first.idempotencyKey.slice(
      0,
      -suffix.length,
    );
  }
}