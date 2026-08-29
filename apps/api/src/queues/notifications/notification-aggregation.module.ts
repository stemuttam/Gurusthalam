import {
  Module,
} from '@nestjs/common';

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
  NotificationAggregationRepository,
} from './notification-aggregation.repository.js';

import {
  NotificationAggregationService,
} from './notification-aggregation.service.js';

import {
  NotificationAggregationSourceEventResolver,
} from './notification-aggregation.source-event.resolver.js';

import {
  NotificationAggregationQueueIntegrationService,
} from './notification-aggregation.queue.integration.service.js';

@Module({
  providers: [
    NotificationAggregationRepository,

    NotificationAggregationPolicy,

    NotificationAggregationService,

    NotificationAggregationFlushService,

    NotificationAggregationSourceEventResolver,

    NotificationAggregationBuilder,

    NotificationAggregationQueueIntegrationService,
  ],

  exports: [
    NotificationAggregationService,

    NotificationAggregationFlushService,

    NotificationAggregationQueueIntegrationService,
  ],
})
export class NotificationAggregationModule {}