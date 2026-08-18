import {
  Controller,
  Param,
  Post,
} from '@nestjs/common';

import {
  NotificationOperationalService,
} from './notification-operational.service.js';

@Controller(
  'internal/notifications',
)
export class NotificationOperationalController {
  constructor(
    private readonly operational:
      NotificationOperationalService,
  ) {}

  @Post(
    ':notificationId/retry',
  )
  async retry(
    @Param('notificationId')
    notificationId: string,
  ) {
    return this.operational.retry(
      notificationId,
    );
  }
}