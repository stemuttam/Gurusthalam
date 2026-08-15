export class NotificationProviderError
  extends Error
{
  constructor(
    message: string,
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message);

    this.name =
      'NotificationProviderError';

    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}