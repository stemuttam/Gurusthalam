/** Raised when an attempt tries to mutate a row it no longer owns. */
export class NotificationAttemptOwnershipLostError extends Error {
  constructor(entity: 'notification' | 'delivery', identifier: string) {
    super(`Notification ${entity} ownership was lost for "${identifier}".`);
    this.name = 'NotificationAttemptOwnershipLostError';
  }
}
