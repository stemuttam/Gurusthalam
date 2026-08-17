export const NotificationFailureClassification = {
  SUCCESS:
    'SUCCESS',

  RETRYABLE:
    'RETRYABLE',

  RATE_LIMITED:
    'RATE_LIMITED',

  NON_RETRYABLE:
    'NON_RETRYABLE',

  PERMANENT:
    'PERMANENT',
} as const;

export type NotificationFailureClassification =
  (typeof NotificationFailureClassification)[keyof typeof NotificationFailureClassification];

export interface NotificationProviderResult {
  readonly accepted: boolean;

  readonly provider: string;

  readonly channel: string;

  readonly notificationId: string;

  readonly messageId?: string;

  readonly classification:
    NotificationFailureClassification;

  readonly errorCode?: string;

  readonly errorMessage?: string;

  readonly retryAfterMs?: number;
}