import {
  Module,
} from '@nestjs/common';

import {
  SafeNotificationTemplateRenderer,
} from '@gurusthalam/shared';

import {
  NotificationTemplateController,
} from './notification-template.controller.js';

import {
  NotificationTemplateRepository,
} from './notification-template.repository.js';

import {
  NotificationTemplateService,
} from './notification-template.service.js';

@Module({
  controllers: [
    NotificationTemplateController,
  ],

  providers: [
    NotificationTemplateRepository,

    NotificationTemplateService,

    SafeNotificationTemplateRenderer,
  ],

  exports: [
    NotificationTemplateService,
  ],
})
export class NotificationTemplateModule {}
