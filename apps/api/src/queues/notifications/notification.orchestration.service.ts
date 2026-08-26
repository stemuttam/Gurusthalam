import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';

import {
  NotificationQueueService,
  type NotificationEnqueueOptions,
  type NotificationEnqueueResult,
} from './notification.queue.js';

import {
  assertNotificationChannelIdentity,
} from './notification-channel-identity.js';

import {
  NotificationChannelPolicy,
} from './notification.channel-policy.js';

import {
  NotificationChannelFallbackPolicy,
  type NotificationChannelFallbackPlan,
} from './notification.channel-fallback-policy.js';

import {
  createNotificationFallbackMetadata,
} from './notification-fallback-identity.js';

import type {
  NotificationCommandChannel,
} from './notification.command.js';

import type {
  NotificationJobData,
} from './notification.types.js';

export type NotificationFallbackMap =
  Partial<
    Record<
      NotificationCommandChannel,
      readonly NotificationCommandChannel[]
    >
  >;

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

  readonly fallbackPlans:
    readonly NotificationChannelFallbackPlan[];
}

@Injectable()
export class NotificationOrchestrationService {
  constructor(
    private readonly queue:
      NotificationQueueService,

    @Optional()
    private readonly channelPolicy:
      NotificationChannelPolicy =
        new NotificationChannelPolicy(),

    @Optional()
    private readonly fallbackPolicy:
      NotificationChannelFallbackPolicy =
        new NotificationChannelFallbackPolicy(),
  ) {}

  async fanOut(
    orchestrationId:
      string,

    notifications:
      readonly NotificationJobData[],

    options:
      NotificationEnqueueOptions =
        {},

    fallbackMap:
      NotificationFallbackMap =
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
      this.validateFallbackMap(
        fallbackMap,

        [],

        logicalId,
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
          [],

        fallbackPlans:
          [],
      };
    }

    const policyResult =
      this.channelPolicy.evaluate(
        notifications.map(
          (
            notification,
          ) =>
            notification.channel,
        ),
      );

    const policyOrderedNotifications =
      this.orderNotificationsByPolicy(
        notifications,

        policyResult.channels,
      );

    this.validateFanOutIdentities(
      logicalId,

      policyOrderedNotifications,
    );

    const fallbackPlans =
      this.validateFallbackMap(
        fallbackMap,

        policyOrderedNotifications.map(
          (
            notification,
          ) =>
            notification.channel,
        ),

        logicalId,
      );

    const fallbackPlansByPrimary =
      new Map<
        NotificationCommandChannel,
        NotificationChannelFallbackPlan
      >();

    for (
      const plan of
        fallbackPlans
    ) {
      fallbackPlansByPrimary.set(
        plan.primary,

        plan,
      );
    }

    const fallbackTargetChannels =
      new Set<NotificationCommandChannel>();

    for (
      const plan of
        fallbackPlans
    ) {
      for (
        const fallbackChannel of
          plan.fallbacks
      ) {
        fallbackTargetChannels.add(
          fallbackChannel,
        );
      }
    }

    /*
     * A channel participating as a fallback must not also be
     * scheduled as an independent primary job. Otherwise the
     * fallback would be delivered immediately instead of only
     * after primary delivery failure.
     */
    const notificationsToEnqueue =
      policyOrderedNotifications.filter(
        (
          notification,
        ) =>
          !fallbackTargetChannels.has(
            notification.channel,
          ),
      );

    const persistedNotifications =
      notificationsToEnqueue.map(
        (
          notification,
        ) => {
          const fallbackPlan =
            fallbackPlansByPrimary.get(
              notification.channel,
            );

          if (
            fallbackPlan ===
            undefined
          ) {
            return notification;
          }

          const fallbackMetadata =
            createNotificationFallbackMetadata(
              logicalId,

              fallbackPlan,

              notification.channel,
            );

          return {
            ...notification,

            fallbackMetadata,
          };
        },
      );

    const results =
      await Promise.all(
        persistedNotifications.map(
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

      fallbackPlans,
    };
  }

  private validateFallbackMap(
    fallbackMap:
      NotificationFallbackMap,

    channels:
      readonly NotificationCommandChannel[],

    orchestrationId:
      string,
  ):
    NotificationChannelFallbackPlan[] {
    const channelSet =
      new Set(
        channels,
      );

    for (
      const key of
        Object.keys(
          fallbackMap,
        )
    ) {
      if (
        !channelSet.has(
          key as NotificationCommandChannel,
        )
      ) {
        throw new BadRequestException(
          `Fallback configuration references channel "${key}" that is not part of the notification fan-out.`,
        );
      }
    }

    const plans:
      NotificationChannelFallbackPlan[] =
      [];

    const fallbackTargetSet =
      new Set<NotificationCommandChannel>();

    for (
      const channel of
        channels
    ) {
      const fallbacks =
        fallbackMap[channel];

      if (
        fallbacks ===
        undefined
      ) {
        continue;
      }

      const plan =
        this.fallbackPolicy.createPlan(
          channel,

          fallbacks,

          this.channelPolicy,
        );

      for (
        const fallbackChannel of
          plan.fallbacks
      ) {
        if (
          channelSet.has(
            fallbackChannel,
          )
        ) {
          throw new BadRequestException(
            `Fallback target channel "${fallbackChannel}" must not also be independently scheduled in the same notification fan-out.`,
          );
        }

        if (
          fallbackTargetSet.has(
            fallbackChannel,
          )
        ) {
          throw new BadRequestException(
            `Fallback target channel "${fallbackChannel}" cannot belong to multiple fallback plans.`,
          );
        }

        fallbackTargetSet.add(
          fallbackChannel,
        );
      }

      /*
       * Validate deterministic identity creation at the
       * orchestration boundary.
       */
      createNotificationFallbackMetadata(
        orchestrationId,

        plan,

        channel,
      );

      plans.push(
        plan,
      );
    }

    return plans;
  }

  private orderNotificationsByPolicy(
    notifications:
      readonly NotificationJobData[],

    orderedChannels:
      readonly NotificationCommandChannel[],
  ):
    readonly NotificationJobData[] {
    const byChannel =
      new Map<
        NotificationCommandChannel,
        NotificationJobData
      >();

    for (
      const notification of
        notifications
    ) {
      byChannel.set(
        notification.channel,

        notification,
      );
    }

    return orderedChannels.map(
      (
        channel,
      ) => {
        const notification =
          byChannel.get(
            channel,
          );

        if (
          notification ===
          undefined
        ) {
          throw new BadRequestException(
            `Channel policy produced channel "${channel}" without a corresponding notification.`,
          );
        }

        return notification;
      },
    );
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