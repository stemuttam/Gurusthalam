import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  NotificationMetricsService,
} from './notification-metrics.service.js';

@Controller(
  'internal/notifications/metrics',
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
    provider: string,
  ) {
    return this.metrics.getProviderMetrics(
      provider,
    );
  }
}