import {
  Global,
  Module,
} from '@nestjs/common';

import {
  BullMqController,
} from './bullmq.controller.js';

import {
  BullMqService,
} from './bullmq.service.js';

import {
  NotificationController,
} from '../notifications/notification.controller.js';

import {
  NotificationCommandController,
} from '../notifications/notification.command.controller.js';

import {
  NotificationQueueService,
} from '../notifications/notification.queue.js';

import {
  SystemQueueController,
} from './system.queue.controller.js';

import {
  SystemQueueService,
} from './system.queue.js';

import {
  NotificationTemplateModule,
} from '../templates/notification-template.module.js';

import {
  NotificationApplicationService,
} from '../notifications/notification.application.service.js';

@Global()
@Module({
  imports: [
    NotificationTemplateModule,
  ],

  controllers: [
    SystemQueueController,

    BullMqController,

    NotificationController,

    NotificationCommandController,
  ],

  providers: [
    BullMqService,

    SystemQueueService,

    NotificationQueueService,

    NotificationApplicationService,
  ],

  exports: [
    BullMqService,

    SystemQueueService,

    NotificationQueueService,

    NotificationApplicationService,
  ],
})
export class BullMqModule {}