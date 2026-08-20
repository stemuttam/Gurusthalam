/*
 * -------------------------------------------------------------
 * Notification Template Domain Types
 * -------------------------------------------------------------
 *
 * Shared by:
 *
 * - API
 * - Worker
 * - future dashboard/backend applications
 *
 * This file contains domain contracts only.
 * It contains no Prisma, Redis, BullMQ, NestJS, or provider code.
 * -------------------------------------------------------------
 */

export const NOTIFICATION_TEMPLATE_CHANNELS =
  {
    EMAIL:
      'email',

    IN_APP:
      'in-app',

    PUSH:
      'push',
  } as const;

export type NotificationTemplateChannel =
  (typeof NOTIFICATION_TEMPLATE_CHANNELS)[keyof typeof NOTIFICATION_TEMPLATE_CHANNELS];

export const NOTIFICATION_TEMPLATE_STATUSES =
  {
    DRAFT:
      'DRAFT',

    REVIEW:
      'REVIEW',

    PUBLISHED:
      'PUBLISHED',

    ARCHIVED:
      'ARCHIVED',
  } as const;

export type NotificationTemplateStatus =
  (typeof NOTIFICATION_TEMPLATE_STATUSES)[keyof typeof NOTIFICATION_TEMPLATE_STATUSES];

export const NOTIFICATION_TEMPLATE_CATEGORIES =
  {
    SYSTEM:
      'SYSTEM',

    SECURITY:
      'SECURITY',

    AUTHENTICATION:
      'AUTHENTICATION',

    COURSE:
      'COURSE',

    LEARNING:
      'LEARNING',

    PAYMENT:
      'PAYMENT',

    SUBSCRIPTION:
      'SUBSCRIPTION',

    CERTIFICATE:
      'CERTIFICATE',

    CORPORATE:
      'CORPORATE',

    MARKETING:
      'MARKETING',

    REMINDER:
      'REMINDER',
  } as const;

export type NotificationTemplateCategory =
  (typeof NOTIFICATION_TEMPLATE_CATEGORIES)[keyof typeof NOTIFICATION_TEMPLATE_CATEGORIES];

export type NotificationTemplateJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type NotificationTemplateJsonValue =
  | NotificationTemplateJsonPrimitive
  | NotificationTemplateJsonValue[]
  | {
      readonly [key: string]:
        NotificationTemplateJsonValue;
    };

export type NotificationTemplateData =
  {
    readonly [key: string]:
      NotificationTemplateJsonValue;
  };

export interface NotificationTemplateVariable {
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
}

export interface NotificationTemplateVersion {
  readonly id:
    string;

  readonly templateId:
    string;

  readonly version:
    number;

  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;

  readonly variables:
    readonly NotificationTemplateVariable[];

  readonly status:
    NotificationTemplateStatus;

  readonly createdBy:
    string;

  readonly createdAt:
    Date;

  readonly publishedAt?:
    Date;
}

export interface NotificationTemplate {
  readonly id:
    string;

  readonly templateId:
    string;

  readonly name:
    string;

  readonly description?:
    string;

  readonly channel:
    NotificationTemplateChannel;

  readonly category:
    NotificationTemplateCategory;

  readonly locale:
    string;

  readonly status:
    NotificationTemplateStatus;

  readonly currentVersion:
    number;

  readonly versions:
    readonly NotificationTemplateVersion[];

  readonly createdBy:
    string;

  readonly createdAt:
    Date;

  readonly updatedAt:
    Date;
}

export interface NotificationTemplateRenderRequest {
  readonly template:
    NotificationTemplateVersion;

  readonly data:
    NotificationTemplateData;

  readonly locale?:
    string;
}

export interface RenderedNotification {
  readonly subject?:
    string;

  readonly title?:
    string;

  readonly body:
    string;
}

export interface NotificationTemplateValidationResult {
  readonly valid:
    boolean;

  readonly errors:
    readonly NotificationTemplateValidationError[];

  readonly warnings:
    readonly NotificationTemplateValidationWarning[];
}

export interface NotificationTemplateValidationError {
  readonly code:
    | 'EMPTY_BODY'
    | 'INVALID_VARIABLE'
    | 'MISSING_REQUIRED_VARIABLE'
    | 'UNSUPPORTED_VARIABLE'
    | 'INVALID_SYNTAX'
    | 'CHANNEL_MISMATCH'
    | 'INVALID_LOCALE';

  readonly message:
    string;

  readonly path?:
    string;
}

export interface NotificationTemplateValidationWarning {
  readonly code:
    | 'UNUSED_VARIABLE'
    | 'OPTIONAL_VARIABLE'
    | 'LOCALE_FALLBACK';

  readonly message:
    string;

  readonly path?:
    string;
}