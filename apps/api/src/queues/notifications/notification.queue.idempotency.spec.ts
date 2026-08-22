import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationQueueService,
} from './notification.queue.js';

import type {
  NotificationJobData,
} from './notification.types.js';

import type {
  NotificationTemplateService,
} from '../templates/notification-template.service.js';

describe(
  'NotificationQueueService idempotency',
  () => {
    const findNotification =
      vi.fn();

    const findOutboxEvent =
      vi.fn();

    const transaction =
      vi.fn();

    const notificationCreate =
      vi.fn();

    const outboxCreate =
      vi.fn();

    const prisma = {
      notification: {
        findUnique:
          findNotification,
      },

      outboxEvent: {
        findUnique:
          findOutboxEvent,
      },

      $transaction:
        transaction,
    };

    const templateService =
      {} as NotificationTemplateService;

    const service =
      new NotificationQueueService(
        prisma as never,
        templateService,
      );

    const baseData:
      NotificationJobData = {
      notificationId:
        'phase-3-2-7-idempotency-001',

      channel:
        'email',

      recipient: {
        userId:
          'user-phase-3-2-7',

        email:
          'phase-3-2-7@gurusthalam.local',
      },

      subject:
        'Idempotency test',

      title:
        'Idempotency test',

      body:
        'Idempotency verification.',

      idempotencyKey:
        'phase-3-2-7-idempotency-001',
    };

    const existingNotification = {
      id:
        'notification-db-id-001',

      notificationId:
        baseData.notificationId,

      status:
        'QUEUED',
    };

    const existingOutbox = {
      id:
        'outbox-db-id-001',
    };

    const createdNotification = {
      id:
        'notification-db-id-created',

      notificationId:
        baseData.notificationId,

      status:
        'QUEUED',
    };

    const createdOutbox = {
      id:
        'outbox-db-id-created',
    };

    function resetMocks(): void {
      findNotification.mockReset();
      findOutboxEvent.mockReset();
      transaction.mockReset();
      notificationCreate.mockReset();
      outboxCreate.mockReset();

      findNotification.mockResolvedValue(
        null,
      );

      findOutboxEvent.mockResolvedValue(
        null,
      );
    }

    function configureSuccessfulTransaction(): void {
      notificationCreate.mockResolvedValue(
        createdNotification,
      );

      outboxCreate.mockResolvedValue(
        createdOutbox,
      );

      transaction.mockImplementation(
        async (
          callback,
        ) =>
          callback({
            notification: {
              create:
                notificationCreate,
            },

            outboxEvent: {
              create:
                outboxCreate,
            },
          }),
      );
    }

    it(
      'creates exactly one Notification and one OutboxEvent for the first request',
      async () => {
        resetMocks();

        configureSuccessfulTransaction();

        const result =
          await service.enqueue(
            baseData,
          );

        expect(
          transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          notificationCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result,
        ).toEqual({
          jobId:
            baseData.idempotencyKey,

          queue:
            'notifications',

          notificationId:
            baseData.notificationId,

          status:
            'QUEUED',

          outboxEventId:
            createdOutbox.id,
        });
      },
    );

    it(
      'returns the existing Notification for a sequential duplicate',
      async () => {
        resetMocks();

        findNotification.mockResolvedValue(
          existingNotification,
        );

        findOutboxEvent.mockResolvedValue(
          existingOutbox,
        );

        const result =
          await service.enqueue(
            baseData,
          );

        expect(
          transaction,
        ).not.toHaveBeenCalled();

        expect(
          notificationCreate,
        ).not.toHaveBeenCalled();

        expect(
          outboxCreate,
        ).not.toHaveBeenCalled();

        expect(
          result,
        ).toEqual({
          jobId:
            baseData.idempotencyKey,

          queue:
            'notifications',

          notificationId:
            existingNotification.notificationId,

          status:
            'QUEUED',

          outboxEventId:
            existingOutbox.id,
        });
      },
    );

    it(
      'does not create another OutboxEvent for a sequential duplicate',
      async () => {
        resetMocks();

        findNotification.mockResolvedValue(
          existingNotification,
        );

        findOutboxEvent.mockResolvedValue(
          existingOutbox,
        );

        await service.enqueue(
          baseData,
        );

        expect(
          findOutboxEvent,
        ).toHaveBeenCalledWith({
          where: {
            dedupeKey:
              `notification:${baseData.idempotencyKey}`,
          },
        });

        expect(
          outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'converges on the winning Notification when a concurrent transaction loses the race',
      async () => {
        resetMocks();

        notificationCreate.mockResolvedValue(
          createdNotification,
        );

        outboxCreate.mockRejectedValue(
          new Error(
            'Unique constraint failed on OutboxEvent.dedupeKey',
          ),
        );

        let transactionCalls =
          0;

        transaction.mockImplementation(
          async (
            callback,
          ) => {
            transactionCalls +=
              1;

            return callback({
              notification: {
                create:
                  notificationCreate,
              },

              outboxEvent: {
                create:
                  outboxCreate,
              },
            });
          },
        );

        /*
         * The transaction failed because another request won.
         * The subsequent re-read must discover that winning row.
         */
        findNotification.mockImplementation(
          async ({
            where,
          }: {
            readonly where: {
              readonly idempotencyKey:
                string;
            };
          }) => {
            if (
              where.idempotencyKey ===
              baseData.idempotencyKey
            ) {
              /*
               * First call = pre-transaction check.
               * Second call = race recovery.
               */
              if (
                findNotification.mock
                  .calls.length ===
                1
              ) {
                return null;
              }

              return existingNotification;
            }

            return null;
          },
        );

        findOutboxEvent.mockResolvedValue(
          existingOutbox,
        );

        const result =
          await service.enqueue(
            baseData,
          );

        expect(
          transactionCalls,
        ).toBe(
          1,
        );

        expect(
          result,
        ).toEqual({
          jobId:
            baseData.idempotencyKey,

          queue:
            'notifications',

          notificationId:
            existingNotification.notificationId,

          status:
            'QUEUED',

          outboxEventId:
            existingOutbox.id,
        });
      },
    );

    it(
      'uses a single idempotency key as the transaction dedupe boundary',
      async () => {
        resetMocks();

        configureSuccessfulTransaction();

        await service.enqueue(
          baseData,
        );

        expect(
          notificationCreate,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                idempotencyKey:
                  baseData.idempotencyKey,
              }),
          }),
        );

        expect(
          outboxCreate,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                dedupeKey:
                  `notification:${baseData.idempotencyKey}`,
              }),
          }),
        );
      },
    );

    it(
      'treats different idempotency keys as independent requests',
      async () => {
        resetMocks();

        configureSuccessfulTransaction();

        const first:
          NotificationJobData = {
          ...baseData,

          notificationId:
            'phase-3-2-7-idempotency-independent-001',

          idempotencyKey:
            'phase-3-2-7-idempotency-independent-001',
        };

        const second:
          NotificationJobData = {
          ...baseData,

          notificationId:
            'phase-3-2-7-idempotency-independent-002',

          idempotencyKey:
            'phase-3-2-7-idempotency-independent-002',
        };

        await service.enqueue(
          first,
        );

        await service.enqueue(
          second,
        );

        expect(
          transaction,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          notificationCreate,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          outboxCreate,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );
  },
);