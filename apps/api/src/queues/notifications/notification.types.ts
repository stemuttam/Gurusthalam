export const NOTIFICATION_CHANNELS = {
  EMAIL:
    'email',

  IN_APP:
    'in-app',

  PUSH:
    'push',
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
      [key: string]:
        NotificationJsonValue;
    };

export interface NotificationRecipient {
  readonly userId:
    string;

  readonly email?:
    string;

  readonly deviceTokens?:
    readonly string[];
}

/**
 * Immutable provenance information describing the exact
 * template version selected before notification rendering.
 *
 * This metadata is persisted with the Notification record.
 */
export interface NotificationTemplateSnapshot {
  readonly templateId:
    string;

  readonly version:
    number;

  readonly locale:
    string;

  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;

  readonly variables:
    readonly {
      readonly path:
        string;

      readonly required:
        boolean;

      readonly description?:
        string;

      readonly type:
        | 'string'
        | 'number'
        | 'boolean'
        | 'object'
        | 'array';
    }[];
}

export interface NotificationJobData {
  readonly notificationId:
    string;

  readonly channel:
    NotificationChannel;

  readonly recipient:
    NotificationRecipient;

  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;

  readonly template?:
    string;

  readonly templateVersion?:
    number;

  readonly templateLocale?:
    string;

  readonly templateData?: {
    [key: string]:
      NotificationJsonValue;
  };

  /**
   * Immutable template provenance snapshot.
   *
   * This is metadata for persistence/audit. The worker does not
   * re-render from this snapshot.
   */
  readonly templateSnapshot?:
    NotificationTemplateSnapshot;

  readonly idempotencyKey:
    string;
}