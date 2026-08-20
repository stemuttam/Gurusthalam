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

@Global()
@Module({
  imports: [
    NotificationTemplateModule,
  ],

  controllers: [
    SystemQueueController,

    BullMqController,

    NotificationController,
  ],

  providers: [
    BullMqService,

    SystemQueueService,

    NotificationQueueService,
  ],

  exports: [
    BullMqService,

    SystemQueueService,

    NotificationQueueService,
  ],
})
export class BullMqModule {}