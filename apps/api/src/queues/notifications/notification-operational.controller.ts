import {
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  InternalApiKeyGuard,
} from '../../security/internal-api-key.guard.js';

import {
  NotificationOperationalService,
} from './notification-operational.service.js';

@Controller(
  'internal/notifications',
)
@UseGuards(
  InternalApiKeyGuard,
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
    notificationId:
      string,
  ) {
    return this.operational.retry(
      notificationId,
    );
  }

  @Post(
    ':notificationId/replay',
  )
  async replay(
    @Param('notificationId')
    notificationId:
      string,
  ) {
    return this.operational.replay(
      notificationId,
    );
  }
}