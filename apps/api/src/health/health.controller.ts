import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { PrismaService } from '../database/prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
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
    const databaseHealthy =
      await this.prisma.checkConnection();

    const status = databaseHealthy
      ? 'ok'
      : 'degraded';

    const statusCode = databaseHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return response
      .status(statusCode)
      .json({
        status,
        service: this.config.name,
        environment: this.config.environment,
        checks: {
          application: 'ok',
          database: databaseHealthy
            ? 'ok'
            : 'failed',
        },
        timestamp: new Date().toISOString(),
      });
  }
}