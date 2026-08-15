export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  IN_APP: 'in-app',
  PUSH: 'push',
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

/**
 * JSON values that can safely be persisted to PostgreSQL JSON/JSONB.
 */
export type NotificationJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type NotificationJsonValue =
  | NotificationJsonPrimitive
  | NotificationJsonValue[]
  | {
      [key: string]: NotificationJsonValue;
    };

export interface NotificationRecipient {
  readonly userId: string;
  readonly email?: string;
  readonly deviceTokens?: readonly string[];
}

export interface NotificationJobData {
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly recipient: NotificationRecipient;
  readonly subject?: string;
  readonly title?: string;
  readonly body: string;
  readonly template?: string;
  readonly templateData?: {
    [key: string]: NotificationJsonValue;
  };
  readonly idempotencyKey: string;
}