import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  NotificationTroubleshootingService,
} from './notification-troubleshooting.service.js';

@Controller(
  'internal/notifications',
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
    @Param('notificationId')
    notificationId: string,
  ) {
    return this.troubleshooting
      .getByNotificationId(
        notificationId,
      );
  }
}