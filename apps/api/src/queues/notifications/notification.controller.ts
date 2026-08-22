import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  NotificationApplicationService,
} from './notification.application.service.js';

import type {
  NotificationRecord,
  NotificationEnqueueResult,
} from './notification.queue.js';

interface EnqueueNotificationRequest {
  readonly notificationId?:
    unknown;

  readonly userId?:
    unknown;

  readonly email?:
    unknown;

  readonly subject?:
    unknown;

  readonly title?:
    unknown;

  readonly body?:
    unknown;

  readonly templateId?:
    unknown;

  readonly templateData?:
    unknown;

  readonly locale?:
    unknown;

  readonly idempotencyKey?:
    unknown;
}

type NotificationGetResponse =
  | {
      readonly found:
        false;

      readonly notificationId:
        string;
    }
  | {
      readonly found:
        true;

      readonly notification:
        NotificationRecord;
    };

@Controller(
  'internal/notifications',
)
export class NotificationController {
  constructor(
    private readonly notificationApplication:
      NotificationApplicationService,
  ) {}

  @Post(
    'smoke',
  )
  async enqueue(
    @Body()
    request:
      EnqueueNotificationRequest,
  ): Promise<NotificationEnqueueResult> {
    const notificationId =
      typeof request.notificationId ===
        'string' &&
      request.notificationId.trim()
        .length > 0
        ? request.notificationId.trim()
        : `notification-${Date.now()}`;

    const userId =
      typeof request.userId ===
        'string' &&
      request.userId.trim()
        .length > 0
        ? request.userId.trim()
        : 'smoke-user';

    const email =
      typeof request.email ===
        'string' &&
      request.email.trim()
        .length > 0
        ? request.email.trim()
        : undefined;

    const subject =
      typeof request.subject ===
        'string' &&
      request.subject.trim()
        .length > 0
        ? request.subject.trim()
        : undefined;

    const title =
      typeof request.title ===
        'string' &&
      request.title.trim()
        .length > 0
        ? request.title.trim()
        : undefined;

    const body =
      typeof request.body ===
        'string' &&
      request.body.trim()
        .length > 0
        ? request.body.trim()
        : undefined;

    const templateId =
      typeof request.templateId ===
        'string' &&
      request.templateId.trim()
        .length > 0
        ? request.templateId.trim()
        : undefined;

    const locale =
      typeof request.locale ===
        'string' &&
      request.locale.trim()
        .length > 0
        ? request.locale.trim()
        : undefined;

    const idempotencyKey =
      typeof request.idempotencyKey ===
        'string' &&
      request.idempotencyKey.trim()
        .length > 0
        ? request.idempotencyKey.trim()
        : `notification-smoke-${Date.now()}`;

    if (
      templateId ===
        undefined &&
      body ===
        undefined
    ) {
      throw new BadRequestException(
        'Either body or templateId must be provided.',
      );
    }

    if (
      templateId !==
        undefined &&
      request.templateData !==
        undefined &&
      (
        typeof request.templateData !==
          'object' ||
        request.templateData ===
          null ||
        Array.isArray(
          request.templateData,
        )
      )
    ) {
      throw new BadRequestException(
        'templateData must be a JSON object when supplied.',
      );
    }

    const templateData =
      templateId !==
        undefined
        ? (
            request.templateData ===
            undefined
              ? {}
              : request.templateData as Record<
                  string,
                  unknown
                >
          )
        : undefined;

    const result =
      await this.notificationApplication.create({
        notificationId,

        userId,

        channel:
          'email',

        recipient: {
          userId,

          ...(email !==
          undefined
            ? {
                email,
              }
            : {}),
        },

        idempotencyKey,

        ...(templateId !==
        undefined
          ? {
              template: {
                templateId,

                templateData:
                  templateData ??
                  {},

                ...(locale !==
                undefined
                  ? {
                      locale,
                    }
                  : {}),
              },
            }
          : {
              content: {
                body:
                  body ??
                  '',

                ...(subject !==
                undefined
                  ? {
                      subject,
                    }
                  : {}),

                ...(title !==
                undefined
                  ? {
                      title,
                    }
                  : {}),
              },
            }),
      });

    return result;
  }

  @Get(
    ':notificationId',
  )
  async getNotification(
    @Param(
      'notificationId',
    )
    notificationId:
      string,
  ): Promise<NotificationGetResponse> {
    /*
     * Notification reads remain on the queue service because
     * that service owns the persistence-facing notification
     * record contract.
     */
    const notification =
  await this.notificationApplication
    .getByNotificationId(
      notificationId,
    );

    if (!notification) {
      return {
        found:
          false,

        notificationId,
      };
    }

    return {
      found:
        true,

      notification,
    };
  }
}