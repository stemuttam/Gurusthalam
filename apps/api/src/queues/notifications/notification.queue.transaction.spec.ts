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
  'NotificationQueueService transactional creation',
  () => {
    const createNotification =
      vi.fn();

    const createOutboxEvent =
      vi.fn();

    const findNotification =
      vi.fn();

    const findOutboxEvent =
      vi.fn();

    const transaction =
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

    const validData:
      NotificationJobData = {
      notificationId:
        'phase-3-2-6-transaction-001',

      channel:
        'email',

      recipient: {
        userId:
          'user-phase-3-2-6',

        email:
          'phase-3-2-6@gurusthalam.local',
      },

      subject:
        'Transactional test',

      title:
        'Transactional notification',

      body:
        'Transaction boundary test.',

      idempotencyKey:
        'phase-3-2-6-transaction-001',
    };

    const createdNotification = {
      id:
        'notification-db-id-001',

      notificationId:
        'phase-3-2-6-transaction-001',

      status:
        'QUEUED',
    };

    const createdOutbox = {
      id:
        'outbox-db-id-001',
    };

    function resetMocks(): void {
      createNotification.mockReset();
      createOutboxEvent.mockReset();
      findNotification.mockReset();
      findOutboxEvent.mockReset();
      transaction.mockReset();

      findNotification.mockResolvedValue(
        null,
      );

      findOutboxEvent.mockResolvedValue(
        null,
      );
    }

    it(
      'creates Notification and OutboxEvent inside the same transaction',
      async () => {
        resetMocks();

        createNotification.mockResolvedValue(
          createdNotification,
        );

        createOutboxEvent.mockResolvedValue(
          createdOutbox,
        );

        transaction.mockImplementation(
          async (
            callback,
          ) =>
            callback({
              notification: {
                create:
                  createNotification,
              },

              outboxEvent: {
                create:
                  createOutboxEvent,
              },
            }),
        );

        const result =
          await service.enqueue(
            validData,
          );

        expect(
          transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          createNotification,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          createOutboxEvent,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result,
        ).toEqual({
          jobId:
            validData.idempotencyKey,

          queue:
            'notifications',

          notificationId:
            validData.notificationId,

          status:
            'QUEUED',

          outboxEventId:
            createdOutbox.id,
        });
      },
    );

    it(
      'creates Notification before OutboxEvent inside the transaction',
      async () => {
        resetMocks();

        const callOrder:
          string[] = [];

        createNotification.mockImplementation(
          async () => {
            callOrder.push(
              'notification',
            );

            return createdNotification;
          },
        );

        createOutboxEvent.mockImplementation(
          async () => {
            callOrder.push(
              'outbox',
            );

            return createdOutbox;
          },
        );

        transaction.mockImplementation(
          async (
            callback,
          ) =>
            callback({
              notification: {
                create:
                  createNotification,
              },

              outboxEvent: {
                create:
                  createOutboxEvent,
              },
            }),
        );

        await service.enqueue(
          validData,
        );

        expect(
          callOrder,
        ).toEqual([
          'notification',
          'outbox',
        ]);
      },
    );

    it(
      'propagates an OutboxEvent failure instead of reporting success',
      async () => {
        resetMocks();

        createNotification.mockResolvedValue(
          createdNotification,
        );

        createOutboxEvent.mockRejectedValue(
          new Error(
            'Simulated outbox failure.',
          ),
        );

        transaction.mockImplementation(
          async (
            callback,
          ) =>
            callback({
              notification: {
                create:
                  createNotification,
              },

              outboxEvent: {
                create:
                  createOutboxEvent,
              },
            }),
        );

        await expect(
          service.enqueue(
            validData,
          ),
        ).rejects.toThrow(
          'Simulated outbox failure.',
        );

        expect(
          transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          createNotification,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          createOutboxEvent,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'does not report a Notification as successfully queued after transaction failure',
      async () => {
        resetMocks();

        createNotification.mockResolvedValue(
          createdNotification,
        );

        createOutboxEvent.mockRejectedValue(
          new Error(
            'Simulated transactional failure.',
          ),
        );

        /*
         * The real queue catches the transaction error and performs
         * a concurrency/idempotency re-check. In a correctly rolled
         * back transaction, the Notification is not visible there.
         */
        findNotification
          .mockResolvedValue(
            null,
          );

        transaction.mockImplementation(
          async (
            callback,
          ) =>
            callback({
              notification: {
                create:
                  createNotification,
              },

              outboxEvent: {
                create:
                  createOutboxEvent,
              },
            }),
        );

        await expect(
          service.enqueue(
            validData,
          ),
        ).rejects.toThrow(
          'Simulated transactional failure.',
        );

        expect(
          findNotification,
        ).toHaveBeenCalledWith({
          where: {
            idempotencyKey:
              validData.idempotencyKey,
          },
        });
      },
    );

    it(
      'does not enter the transaction when idempotency already finds the Notification',
      async () => {
        resetMocks();

        findNotification.mockResolvedValue(
          createdNotification,
        );

        findOutboxEvent.mockResolvedValue({
          id:
            createdOutbox.id,
        });

        const result =
          await service.enqueue(
            validData,
          );

        expect(
          transaction,
        ).not.toHaveBeenCalled();

        expect(
          createNotification,
        ).not.toHaveBeenCalled();

        expect(
          createOutboxEvent,
        ).not.toHaveBeenCalled();

        expect(
          result,
        ).toEqual({
          jobId:
            validData.idempotencyKey,

          queue:
            'notifications',

          notificationId:
            validData.notificationId,

          status:
            'QUEUED',

          outboxEventId:
            createdOutbox.id,
        });
      },
    );
  },
);