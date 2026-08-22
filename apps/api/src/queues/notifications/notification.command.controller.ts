import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import {
  NotificationApplicationService,
} from './notification.application.service.js';

import type {
  NotificationEnqueueResult,
} from './notification.queue.js';

import {
  parseCreateNotificationHttpRequest,
} from './notification.command.dto.js';

@Controller(
  'notifications',
)
export class NotificationCommandController {
  constructor(
    private readonly notificationApplication:
      NotificationApplicationService,
  ) {}

  @Post()
  @HttpCode(
    HttpStatus.ACCEPTED,
  )
  async create(
    @Body()
    request: unknown,
  ): Promise<NotificationEnqueueResult> {
    const command =
      parseCreateNotificationHttpRequest(
        request,
      );

    return this.notificationApplication.create(
      command,
    );
  }
}