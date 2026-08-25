import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationApplicationService,
} from './notification.application.service.js';

import type {
  CreateNotificationCommand,
} from './notification.command.js';

describe(
  'NotificationApplicationService - multi-channel orchestration',
  () => {
    const enqueue =
      vi.fn();

    const fanOut =
      vi.fn();

    const queue =
      {
        enqueue,
      } as never;

    const orchestration =
      {
        fanOut,
      } as never;

    const service =
      new NotificationApplicationService(
        queue,

        orchestration,
      );

    it(
      'fans out a multi-channel command into independent channel jobs',
      async () => {
        enqueue.mockReset();

        fanOut.mockReset();

        fanOut.mockResolvedValue({
          orchestrationId:
            'phase-3-2-15-application-001',

          notificationId:
            'phase-3-2-15-application-001',

          accepted:
            true,

          action:
            'fan-out-scheduled',

          channels:
            [],
        });

        const command:
          CreateNotificationCommand =
          {
            notificationId:
              'phase-3-2-15-application-001',

            userId:
              'user-001',

            channels: [
              'email',
              'push',
            ],

            recipient: {
              userId:
                'user-001',

              email:
                'user-001@example.com',

              deviceTokens: [
                'device-001',
              ],
            },

            idempotencyKey:
              'phase-3-2-15-application-001',

            content: {
              body:
                'Multi-channel application test.',
            },
          };

        const result =
          await service.create(
            command,
          );

        expect(
          result,
        ).toMatchObject({
          accepted:
            true,

          action:
            'fan-out-scheduled',
        });

        expect(
          fanOut,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          enqueue,
        ).not.toHaveBeenCalled();

        const call =
          fanOut.mock.calls[0];

        expect(
          call,
        ).toBeDefined();

        const orchestrationId =
          call?.[0];

        const data =
          call?.[1];

        expect(
          orchestrationId,
        ).toBe(
          'phase-3-2-15-application-001',
        );

        expect(
          Array.isArray(
            data,
          ),
        ).toBe(
          true,
        );

        if (
          !Array.isArray(
            data,
          )
        ) {
          throw new Error(
            'Expected fan-out data to be an array.',
          );
        }

        expect(
          data.map(
            (
              item:
                CreateNotificationCommand extends never
                  ? never
                  : {
                      readonly notificationId:
                        string;
                      readonly idempotencyKey:
                        string;
                    },
            ) =>
              item.notificationId,
          ),
        ).toEqual([
          'phase-3-2-15-application-001:email',
          'phase-3-2-15-application-001:push',
        ]);

        expect(
          data.map(
            (
              item:
                CreateNotificationCommand extends never
                  ? never
                  : {
                      readonly notificationId:
                        string;
                      readonly idempotencyKey:
                        string;
                    },
            ) =>
              item.idempotencyKey,
          ),
        ).toEqual([
          'phase-3-2-15-application-001:email',
          'phase-3-2-15-application-001:push',
        ]);
      },
    );

    it(
      'preserves the legacy single-channel queue path',
      async () => {
        enqueue.mockReset();

        fanOut.mockReset();

        enqueue.mockResolvedValue({
          jobId:
            'phase-3-2-15-single',

          queue:
            'notifications',

          notificationId:
            'phase-3-2-15-single',

          status:
            'QUEUED',

          outboxEventId:
            'outbox-single',
        });

        const command:
          CreateNotificationCommand =
          {
            notificationId:
              'phase-3-2-15-single',

            userId:
              'user-001',

            channel:
              'email',

            recipient: {
              userId:
                'user-001',

              email:
                'user-001@example.com',
            },

            idempotencyKey:
              'phase-3-2-15-single',

            content: {
              body:
                'Legacy-compatible single-channel test.',
            },
          };

        const result =
          await service.create(
            command,
          );

        expect(
          'status' in
          result,
        ).toBe(
          true,
        );

        if (
          'status' in
          result
        ) {
          expect(
            result.status,
          ).toBe(
            'QUEUED',
          );
        }

        expect(
          enqueue,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          fanOut,
        ).not.toHaveBeenCalled();
      },
    );
  },
);