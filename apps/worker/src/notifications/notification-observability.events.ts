export const NotificationObservabilityEvent = {
  PROCESS:
    'notification.process',

  PROCESSING:
    'notification.processing',

  PROVIDER_ACCEPTED:
    'notification.provider.accepted',

  PROVIDER_IDEMPOTENT_HIT:
    'notification.provider.idempotent_hit',

  DELIVERY:
    'notification.delivered',

  RETRY:
    'notification.retrying',

  FAILED:
    'notification.failed',

  IDEMPOTENT_SKIP:
    'notification.delivery.idempotent_skip',

  PROVIDER_ERROR:
    'notification.provider.error',
} as const;

export type NotificationObservabilityEvent =
  (typeof NotificationObservabilityEvent)[keyof typeof NotificationObservabilityEvent];