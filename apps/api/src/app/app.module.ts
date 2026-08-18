import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import {
  AppConfigModule,
} from '../config/app-config.module.js';

import {
  DatabaseModule,
} from '../database/database.module.js';

import {
  HealthModule,
} from '../health/health.module.js';

import {
  RequestIdMiddleware,
} from '../middleware/request-id.middleware.js';

import {
  RedisModule,
} from '../queues/redis/redis.module.js';

import {
  BullMqModule,
} from '../queues/bullmq/bullmq.module.js';

import {
  AppController,
} from './app.controller.js';

import {
  AppService,
} from './app.service.js';

import {
  OutboxAdminController,
} from '../queues/outbox/outbox-admin.controller.js';

import {
  OutboxAdminService,
} from '../queues/outbox/outbox-admin.service.js';

import {
  NotificationMetricsController,
} from '../queues/notifications/notification-metrics.controller.js';

import {
  NotificationMetricsService,
} from '../queues/notifications/notification-metrics.service.js';
import {
  NotificationTroubleshootingController,
} from '../queues/notifications/notification-troubleshooting.controller.js';

import {
  NotificationTroubleshootingService,
} from '../queues/notifications/notification-troubleshooting.service.js';

  import {
  NotificationOperationalController,
} from '../queues/notifications/notification-operational.controller.js';

import {
  NotificationOperationalService,
} from '../queues/notifications/notification-operational.service.js';



@Module({
  imports: [
    AppConfigModule,

    DatabaseModule,

    RedisModule,

    BullMqModule,

    HealthModule,
  ],

  controllers: [
  AppController,
  OutboxAdminController,
  NotificationMetricsController,
  NotificationTroubleshootingController,
  NotificationOperationalController,
],

  providers: [
  AppService,
  OutboxAdminService,
  NotificationMetricsService,
  NotificationTroubleshootingService,
  NotificationOperationalService,
],

})
export class AppModule
  implements NestModule
{
  configure(
    consumer: MiddlewareConsumer,
  ): void {
    consumer
      .apply(
        RequestIdMiddleware,
      )
      .forRoutes({
        path:
          '{*splat}',

        method:
          RequestMethod.ALL,
      });
  }
}