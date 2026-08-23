import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import {
  InternalApiKeyGuard,
} from '../../security/internal-api-key.guard.js';

import {
  NotificationTroubleshootingService,
} from './notification-troubleshooting.service.js';

@Controller(
  'internal/notifications',
)
@UseGuards(
  InternalApiKeyGuard,
)
export class NotificationTroubleshootingController {
  constructor(
    private readonly troubleshooting:
      NotificationTroubleshootingService,
  ) {}

  @Get(
    ':notificationId/troubleshooting',
  )
  async getTroubleshooting(
    @Param(
      'notificationId',
    )
    notificationId:
      string,
  ) {
    return this.troubleshooting
      .getByNotificationId(
        notificationId,
      );
  }
}