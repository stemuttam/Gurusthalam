export type NotificationCommandChannel =
  | 'email'
  | 'in-app'
  | 'push';

export interface NotificationCommandRecipient {
  readonly userId:
    string;

  readonly email?:
    string;

  readonly deviceTokens?:
    readonly string[];
}

export interface NotificationTemplateCommand {
  readonly templateId:
    string;

  readonly templateData:
    Record<
      string,
      unknown
    >;

  readonly locale?:
    string;
}

export interface NotificationLiteralContent {
  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;
}

export interface CreateNotificationCommand {
  readonly notificationId:
    string;

  readonly userId:
    string;

  /*
   * Backward-compatible single-channel command form.
   */
  readonly channel?:
    NotificationCommandChannel;

  /*
   * New multi-channel orchestration form.
   */
  readonly channels?:
    readonly NotificationCommandChannel[];

  readonly recipient:
    NotificationCommandRecipient;

  readonly idempotencyKey:
    string;

  readonly template?:
    NotificationTemplateCommand;

  readonly content?:
    NotificationLiteralContent;
}
