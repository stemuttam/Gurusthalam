import type { Job } from 'bullmq';

import { GurusthalamLogger } from '@gurusthalam/logger';

import {
  NotificationProviderRegistry,
} from '../providers/notification/notification-provider.registry.js';

import {
  NotificationPersistenceService,
} from '../notifications/notification-persistence.service.js';

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'in-app',
  PUSH: 'push',
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

/**
 * JSON values that are safe to persist in PostgreSQL JSON/JSONB.
 */
export type NotificationJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type NotificationJsonValue =
  | NotificationJsonPrimitive
  | NotificationJsonValue[]
  | {
      [key: string]: NotificationJsonValue;
    };

export interface NotificationRecipient {
  readonly userId: string;
  readonly email?: string;
  readonly deviceTokens?: readonly string[];
}

export interface NotificationJobData {
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly recipient: NotificationRecipient;
  readonly subject?: string;
  readonly title?: string;
  readonly body: string;
  readonly template?: string;
  readonly templateData?: {
    [key: string]: NotificationJsonValue;
  };
  readonly idempotencyKey: string;
}

export interface NotificationJobResult {
  readonly processed: true;
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly provider: string;
  readonly messageId: string;
}

export class NotificationProcessor {
  constructor(
    private readonly logger: GurusthalamLogger,
    private readonly providerRegistry: NotificationProviderRegistry,
    private readonly persistence: NotificationPersistenceService,
  ) {}

  async process(
    job: Job<NotificationJobData>,
  ): Promise<NotificationJobResult> {
    const notification = job.data;

    const attempt = job.attemptsMade + 1;

    const maxAttempts =
      typeof job.opts.attempts === 'number'
        ? job.opts.attempts
        : 1;

    this.logger.info(
      `Processing notification job: ${
        job.id ?? 'unknown'
      }`,
      {
        operation: 'notification.process',
        service: notification.channel,
      },
    );

    await this.persistence.markProcessing(
      notification,
      attempt,
    );

    try {
      const provider =
        this.providerRegistry.get(
          notification.channel,
        );

      const delivery =
        await provider.send(
          notification,
        );

      if (!delivery.accepted) {
        throw new Error(
          `Notification provider "${delivery.provider}" did not accept notification "${notification.notificationId}".`,
        );
      }

      await this.persistence.markSent(
        notification.notificationId,
        delivery.provider,
        delivery.messageId,
      );

      this.logger.info(
        `Notification delivered: ${notification.notificationId}`,
        {
          operation: 'notification.delivered',
          service: delivery.provider,
        },
      );

      return {
        processed: true,
        notificationId:
          notification.notificationId,
        channel:
          notification.channel,
        provider:
          delivery.provider,
        messageId:
          delivery.messageId,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (attempt < maxAttempts) {
        await this.persistence.markRetrying(
          notification.notificationId,
          message,
          attempt,
        );
      } else {
        await this.persistence.markFailed(
          notification.notificationId,
          message,
          attempt,
        );
      }

      throw error;
    }
  }
}