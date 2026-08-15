import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../database/prisma/prisma.service.js';
import { BullMqService } from '../queues/bullmq/bullmq.service.js';
import { RedisService } from '../queues/redis/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bullMq: BullMqService,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: this.config.name,
      environment: this.config.environment,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(
    @Res() response: Response,
  ) {
    const [
      databaseHealthy,
      redisHealthy,
      bullMqHealthy,
    ] = await Promise.all([
      this.prisma.checkConnection(),
      this.redis.ping(),
      this.bullMq.ping(),
    ]);

    const ready =
      databaseHealthy &&
      redisHealthy &&
      bullMqHealthy;

    return response
      .status(
        ready
          ? HttpStatus.OK
          : HttpStatus.SERVICE_UNAVAILABLE,
      )
      .json({
        status: ready
          ? 'ok'
          : 'degraded',
        service: this.config.name,
        environment: this.config.environment,
        checks: {
          application: 'ok',
          database: databaseHealthy
            ? 'ok'
            : 'failed',
          redis: redisHealthy
            ? 'ok'
            : 'failed',
          bullmq: bullMqHealthy
            ? 'ok'
            : 'failed',
        },
        timestamp: new Date().toISOString(),
      });
  }
}