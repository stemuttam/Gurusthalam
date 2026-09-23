import { Queue } from 'bullmq';

import { getRedisConfig } from '@gurusthalam/config';

import type {
  NotificationJobData,
  NotificationJsonValue,
} from '../processors/notification.processor.js';

import {
  getNotificationRetryPolicy,
  NOTIFICATION_RETRY_BACKOFF_TYPE,
} from '../notifications/notification-retry.policy.js';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

/**
 * Notification-specific Outbox publisher.
 *
 * The generic Outbox dispatcher must not know notification payload
 * structure. All notification payload validation and BullMQ transport
 * behavior lives behind this handler.
 */
export class NotificationOutboxDispatchHandler {
  constructor(private readonly queue: Queue<NotificationJobData>) {}

  static fromRedisConfig(): NotificationOutboxDispatchHandler {
    const redis = getRedisConfig();

    const queue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
      connection: {
        url: redis.url,
      },
      prefix: QUEUE_PREFIX,
    });

    return new NotificationOutboxDispatchHandler(queue);
  }

  async dispatch(payload: unknown): Promise<void> {
    const data = this.parseNotificationData(payload);

    /*
     * Notification execution retry is separate from PostgreSQL
     * Outbox retry.
     */
    const retryPolicy = getNotificationRetryPolicy();

    await this.queue.add(`notification:${data.channel}`, data, {
      /*
       * Preserve the existing deterministic notification identity.
       */
      jobId: data.idempotencyKey,

      attempts: retryPolicy.maxAttempts,

      backoff: {
        type: NOTIFICATION_RETRY_BACKOFF_TYPE,
      },

      removeOnComplete: 100,

      removeOnFail: 1000,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  private parseNotificationData(payload: unknown): NotificationJobData {
    if (!this.isRecord(payload)) {
      throw new Error('Invalid notification outbox payload.');
    }

    const notificationId = this.requireString(payload, 'notificationId');

    const channel = this.parseChannel(payload.channel);

    const idempotencyKey = this.requireString(payload, 'idempotencyKey');

    const body = this.requireString(payload, 'body');

    const recipient = this.parseRecipient(payload.recipient);

    const deliveryKey =
      payload.deliveryKey !== undefined
        ? this.requireStringValue(payload.deliveryKey, 'deliveryKey')
        : undefined;

    const subject =
      payload.subject !== undefined
        ? this.requireStringValue(payload.subject, 'subject')
        : undefined;

    const title =
      payload.title !== undefined
        ? this.requireStringValue(payload.title, 'title')
        : undefined;

    const template =
      payload.template !== undefined
        ? this.requireStringValue(payload.template, 'template')
        : undefined;

    const templateData =
      payload.templateData !== undefined
        ? this.parseTemplateData(payload.templateData)
        : undefined;

    return {
      notificationId,
      channel,
      recipient,
      body,
      idempotencyKey,

      ...(deliveryKey !== undefined
        ? {
            deliveryKey,
          }
        : {}),

      ...(subject !== undefined
        ? {
            subject,
          }
        : {}),

      ...(title !== undefined
        ? {
            title,
          }
        : {}),

      ...(template !== undefined
        ? {
            template,
          }
        : {}),

      ...(templateData !== undefined
        ? {
            templateData,
          }
        : {}),
    };
  }

  private parseChannel(value: unknown): NotificationJobData['channel'] {
    if (value === 'email' || value === 'in-app' || value === 'push') {
      return value;
    }

    throw new Error('Outbox payload channel is invalid.');
  }

  private parseRecipient(value: unknown): NotificationJobData['recipient'] {
    if (!this.isRecord(value)) {
      throw new Error('Outbox payload recipient is invalid.');
    }

    const userId = this.requireString(value, 'userId');

    const email =
      value.email !== undefined
        ? this.requireStringValue(value.email, 'recipient.email')
        : undefined;

    const deviceTokens =
      value.deviceTokens !== undefined
        ? this.parseDeviceTokens(value.deviceTokens)
        : undefined;

    return {
      userId,

      ...(email !== undefined
        ? {
            email,
          }
        : {}),

      ...(deviceTokens !== undefined
        ? {
            deviceTokens,
          }
        : {}),
    };
  }

  private parseDeviceTokens(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new Error('Outbox payload recipient.deviceTokens is invalid.');
    }

    return value.map((token) =>
      this.requireStringValue(token, 'recipient.deviceTokens'),
    );
  }

  private parseTemplateData(value: unknown): {
    [key: string]: NotificationJsonValue;
  } {
    if (!this.isJsonObject(value)) {
      throw new Error('Outbox payload templateData is invalid.');
    }

    return value;
  }

  private requireString(value: Record<string, unknown>, key: string): string {
    return this.requireStringValue(value[key], key);
  }

  private requireStringValue(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Outbox payload ${field} is invalid.`);
    }

    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  private isJsonPrimitive(
    value: unknown,
  ): value is string | number | boolean | null {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private isJsonValue(value: unknown): value is NotificationJsonValue {
    if (this.isJsonPrimitive(value)) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item));
    }

    if (this.isRecord(value)) {
      return Object.values(value).every((item) => this.isJsonValue(item));
    }

    return false;
  }

  private isJsonObject(value: unknown): value is {
    [key: string]: NotificationJsonValue;
  } {
    return (
      this.isRecord(value) &&
      Object.values(value).every((item) => this.isJsonValue(item))
    );
  }
}
