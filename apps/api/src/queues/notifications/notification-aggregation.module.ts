import {
  Module,
} from '@nestjs/common';

import {
  NotificationQueueModule,
} from './notification-queue.module.js';

import {
  NotificationAggregationBuilder,
} from './notification-aggregation.builder.js';

import {
  NotificationAggregationFlushService,
} from './notification-aggregation.flush.service.js';

import {
  NotificationAggregationPolicy,
} from './notification-aggregation.policy.js';

import {
  NotificationAggregationQueueIntegrationService,
} from './notification-aggregation.queue.integration.service.js';

import {
  NotificationAggregationRepository,
} from './notification-aggregation.repository.js';

import {
  NotificationAggregationSchedulerService,
} from './notification-aggregation.scheduler.js';

import {
  NotificationAggregationService,
} from './notification-aggregation.service.js';

import {
  NotificationAggregationSourceEventResolver,
} from './notification-aggregation.source-event.resolver.js';

@Module({
  imports: [
    NotificationQueueModule,
  ],

  providers: [
    NotificationAggregationRepository,

    NotificationAggregationPolicy,

    NotificationAggregationService,

    NotificationAggregationFlushService,

    NotificationAggregationSourceEventResolver,

    NotificationAggregationBuilder,

    NotificationAggregationQueueIntegrationService,

    NotificationAggregationSchedulerService,
  ],

  exports: [
    NotificationAggregationService,

    NotificationAggregationFlushService,

    NotificationAggregationQueueIntegrationService,

    NotificationAggregationSchedulerService,
  ],
})
export class NotificationAggregationModule {}