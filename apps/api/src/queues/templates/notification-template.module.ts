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
  NotificationTemplateResolutionService,
} from './notification-template-resolution.service.js';

import {
  NotificationTemplateService,
} from './notification-template.service.js';

@Module({
  controllers: [
    NotificationTemplateController,
  ],

  providers: [
    NotificationTemplateRepository,

    NotificationTemplateResolutionService,

    NotificationTemplateService,

    SafeNotificationTemplateRenderer,
  ],

  exports: [
    NotificationTemplateResolutionService,

    NotificationTemplateService,
  ],
})
export class NotificationTemplateModule {}