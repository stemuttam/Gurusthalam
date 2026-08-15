import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { AppConfigModule } from '../config/app-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { HealthModule } from '../health/health.module.js';
import { RequestIdMiddleware } from '../middleware/request-id.middleware.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(
    consumer: MiddlewareConsumer,
  ): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({
        path: '{*splat}',
        method: RequestMethod.ALL,
      });
  }
}