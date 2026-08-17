import type {
  NotificationLifecycleStatus,
} from './notification-lifecycle.service.js';

const transitions:
  Record<
    NotificationLifecycleStatus,
    readonly NotificationLifecycleStatus[]
  > = {
    QUEUED: [
      'PROCESSING',
      'FAILED',
    ],

    PROCESSING: [
      'SENT',
      'RETRYING',
      'FAILED',
    ],

    RETRYING: [
      'PROCESSING',
      'FAILED',
    ],

    SENT: [],

    FAILED: [
      'QUEUED',
      'PROCESSING',
    ],
  };

export function canTransitionNotification(
  from: NotificationLifecycleStatus,
  to: NotificationLifecycleStatus,
): boolean {
  return transitions[from].includes(
    to,
  );
}