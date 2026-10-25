/**
 * Signals that provider submission may have succeeded, but durable acceptance
 * could not be confirmed. Callers must stop fallback and automatic resend.
 */
export class NotificationDeliveryAcceptanceUncertainError extends Error {
  constructor(
    readonly deliveryKey: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'NotificationDeliveryAcceptanceUncertainError';
  }
}
