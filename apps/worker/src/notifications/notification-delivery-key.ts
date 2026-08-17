import {
  createHash,
} from 'node:crypto';

export function createNotificationDeliveryKey(
  notificationId: string,
  channel: string,
  provider: string,
): string {
  const source =
    [
      notificationId,
      channel,
      provider,
    ].join(':');

  return createHash('sha256')
    .update(source)
    .digest('hex');
}