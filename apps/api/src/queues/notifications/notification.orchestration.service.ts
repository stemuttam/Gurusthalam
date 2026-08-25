import {
  Injectable,
} from '@nestjs/common';

import {
  NotificationQueueService,
  type NotificationEnqueueOptions,
  type NotificationEnqueueResult,
} from './notification.queue.js';

import type {
  NotificationJobData,
} from './notification.types.js';

export interface NotificationOrchestrationChildResult
  extends NotificationEnqueueResult {
  readonly channel:
    NotificationJobData['channel'];
}

export interface NotificationOrchestrationResult {
  readonly orchestrationId:
    string;

  readonly notificationId:
    string;

  readonly accepted:
    true;

  readonly action:
    'fan-out-scheduled';

  readonly channels:
    readonly NotificationOrchestrationChildResult[];
}

@Injectable()
export class NotificationOrchestrationService {
  constructor(
    private readonly queue:
      NotificationQueueService,
  ) {}

  async fanOut(
    orchestrationId:
      string,

    notifications:
      readonly NotificationJobData[],

    options:
      NotificationEnqueueOptions =
        {},
  ):
    Promise<NotificationOrchestrationResult> {
    if (
      notifications.length ===
      0
    ) {
      return {
        orchestrationId,

        notificationId:
          orchestrationId,

        accepted:
          true,

        action:
          'fan-out-scheduled',

        channels:
          [],
      };
    }

    const results =
      await Promise.all(
        notifications.map(
          async (
            notification,
          ) => {
            const result =
              await this.queue.enqueue(
                notification,

                options,
              );

            return {
              ...result,

              channel:
                notification.channel,
            };
          },
        ),
      );

    return {
      orchestrationId,

      notificationId:
        orchestrationId,

      accepted:
        true,

      action:
        'fan-out-scheduled',

      channels:
        results,
    };
  }
}