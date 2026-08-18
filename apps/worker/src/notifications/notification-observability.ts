import type {
  NotificationChannel,
  NotificationJobData,
} from '../processors/notification.processor.js';

export interface NotificationLogIdentity {
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly jobId: string;
  readonly deliveryKey?: string;
  readonly provider?: string;
  readonly attempt?: number;
}

export function formatNotificationIdentity(
  identity: NotificationLogIdentity,
): string {
  const parts = [
    `notificationId=${identity.notificationId}`,
    `channel=${identity.channel}`,
    `jobId=${identity.jobId}`,
  ];

  if (
    identity.deliveryKey !==
    undefined
  ) {
    parts.push(
      `deliveryKey=${identity.deliveryKey}`,
    );
  }

  if (
    identity.provider !==
    undefined
  ) {
    parts.push(
      `provider=${identity.provider}`,
    );
  }

  if (
    identity.attempt !==
    undefined
  ) {
    parts.push(
      `attempt=${identity.attempt}`,
    );
  }

  return `[${parts.join(' ')}]`;
}

export function createNotificationLogIdentity(
  notification: NotificationJobData,
  jobId: string,
  options?: {
    readonly deliveryKey?: string;
    readonly provider?: string;
    readonly attempt?: number;
  },
): NotificationLogIdentity {
  return {
    notificationId:
      notification.notificationId,

    channel:
      notification.channel,

    jobId,

    ...(options?.deliveryKey !==
    undefined
      ? {
          deliveryKey:
            options.deliveryKey,
        }
      : {}),

    ...(options?.provider !==
    undefined
      ? {
          provider:
            options.provider,
        }
      : {}),

    ...(options?.attempt !==
    undefined
      ? {
          attempt:
            options.attempt,
        }
      : {}),
  };
}