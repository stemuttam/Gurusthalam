import type {
  NotificationCommandChannel,
} from './notification.command.js';

export interface NotificationChannelIdentity {
  readonly channel:
    NotificationCommandChannel;

  readonly notificationId:
    string;

  readonly idempotencyKey:
    string;
}

/**
 * Creates the canonical child identities for one logical
 * multi-channel notification.
 *
 * The logical notification identity remains stable while every
 * channel receives an independent persistence/idempotency identity.
 */
export function createNotificationChannelIdentity(
  notificationId:
    string,

  idempotencyKey:
    string,

  channel:
    NotificationCommandChannel,
):
  NotificationChannelIdentity {
  const normalizedNotificationId =
    notificationId.trim();

  const normalizedIdempotencyKey =
    idempotencyKey.trim();

  if (
    normalizedNotificationId.length ===
    0
  ) {
    throw new Error(
      'notificationId must be non-empty.',
    );
  }

  if (
    normalizedIdempotencyKey.length ===
    0
  ) {
    throw new Error(
      'idempotencyKey must be non-empty.',
    );
  }

  return {
    channel,

    notificationId:
      `${normalizedNotificationId}:${channel}`,

    idempotencyKey:
      `${normalizedIdempotencyKey}:${channel}`,
  };
}

/**
 * Validates that a NotificationJobData item is the canonical
 * child identity for the supplied logical notification.
 */
export function assertNotificationChannelIdentity(
  orchestrationId:
    string,

  logicalIdempotencyKey:
    string,

  child:
    {
      readonly channel:
        NotificationCommandChannel;

      readonly notificationId:
        string;

      readonly idempotencyKey:
        string;
    },
):
  void {
  const expected =
    createNotificationChannelIdentity(
      orchestrationId,

      logicalIdempotencyKey,

      child.channel,
    );

  if (
    child.notificationId !==
    expected.notificationId
  ) {
    throw new Error(
      `Invalid notification identity for channel "${child.channel}". Expected "${expected.notificationId}" but received "${child.notificationId}".`,
    );
  }

  if (
    child.idempotencyKey !==
    expected.idempotencyKey
  ) {
    throw new Error(
      `Invalid idempotency identity for channel "${child.channel}". Expected "${expected.idempotencyKey}" but received "${child.idempotencyKey}".`,
    );
  }
}