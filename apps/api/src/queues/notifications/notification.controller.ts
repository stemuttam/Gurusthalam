import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  NotificationQueueService,
  type NotificationRecord,
  type NotificationEnqueueResult,
} from './notification.queue.js';

import type {
  NotificationJobData,
} from './notification.types.js';

interface EnqueueNotificationRequest {
  readonly notificationId?: unknown;
  readonly userId?: unknown;
  readonly email?: unknown;
  readonly subject?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly idempotencyKey?: unknown;
}

type NotificationGetResponse =
  | {
      readonly found: false;
      readonly notificationId: string;
    }
  | {
      readonly found: true;
      readonly notification: NotificationRecord;
    };

@Controller('internal/notifications')
export class NotificationController {
  constructor(
    private readonly notificationQueue:
      NotificationQueueService,
  ) {}

  @Post('smoke')
  async enqueue(
    @Body()
    request: EnqueueNotificationRequest,
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
        : 'smoke@gurusthalam.local';

    const subject =
      typeof request.subject ===
        'string' &&
      request.subject.trim()
        .length > 0
        ? request.subject.trim()
        : 'Gurusthalam notification smoke test';

    const title =
      typeof request.title ===
        'string' &&
      request.title.trim()
        .length > 0
        ? request.title.trim()
        : 'Gurusthalam notification';

    const body =
      typeof request.body ===
        'string' &&
      request.body.trim()
        .length > 0
        ? request.body.trim()
        : 'This is a notification worker smoke test.';

    const idempotencyKey =
      typeof request.idempotencyKey ===
        'string' &&
      request.idempotencyKey.trim()
        .length > 0
        ? request.idempotencyKey.trim()
        : `notification-smoke-${Date.now()}`;

    const data:
      NotificationJobData = {
      notificationId,

      channel: 'email',

      recipient: {
        userId,
        email,
      },

      subject,

      title,

      body,

      idempotencyKey,
    };

    return this.notificationQueue.enqueue(
      data,
    );
  }

  @Get(':notificationId')
  async getNotification(
    @Param('notificationId')
    notificationId: string,
  ): Promise<NotificationGetResponse> {
    const notification =
      await this.notificationQueue
        .getByNotificationId(
          notificationId,
        );

    if (!notification) {
      return {
        found: false,
        notificationId,
      };
    }

    return {
      found: true,
      notification,
    };
  }
}