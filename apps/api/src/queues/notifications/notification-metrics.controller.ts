import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import {
  InternalApiKeyGuard,
} from '../../security/internal-api-key.guard.js';

import {
  NotificationMetricsService,
} from './notification-metrics.service.js';

@Controller(
  'internal/notifications/metrics',
)
@UseGuards(
  InternalApiKeyGuard,
)
export class NotificationMetricsController {
  constructor(
    private readonly metrics:
      NotificationMetricsService,
  ) {}

  @Get()
  async getMetrics() {
    return this.metrics.getMetrics();
  }

  @Get(
    'providers/:provider',
  )
  async getProviderMetrics(
    @Param('provider')
    provider:
      string,
  ) {
    return this.metrics.getProviderMetrics(
      provider,
    );
  }
}