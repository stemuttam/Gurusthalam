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
  OutboxAdminController,
} from '../queues/outbox/outbox-admin.controller.js';

import {
  OutboxAdminService,
} from '../queues/outbox/outbox-admin.service.js';

import {
  AppController,
} from './app.controller.js';

import {
  AppService,
} from './app.service.js';

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
  ],

  providers: [
    AppService,
    OutboxAdminService,
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
        path: '{*splat}',
        method:
          RequestMethod.ALL,
      });
  }
}