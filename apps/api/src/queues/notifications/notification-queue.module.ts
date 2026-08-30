import {
  Module,
} from '@nestjs/common';

import {
  NotificationTemplateModule,
} from '../templates/notification-template.module.js';

import {
  NotificationQueueService,
} from './notification.queue.js';

@Module({
  imports: [
    NotificationTemplateModule,
  ],

  providers: [
    NotificationQueueService,
  ],

  exports: [
    NotificationQueueService,
  ],
})
export class NotificationQueueModule {}