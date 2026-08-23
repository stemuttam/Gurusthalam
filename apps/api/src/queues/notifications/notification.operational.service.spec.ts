import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  NotificationOperationalService,
} from './notification-operational.service.js';

type NotificationStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'RETRYING'
  | 'FAILED';

type MockNotification = {
  id: string;
  notificationId: string;
  userId: string;
  channel:
    | 'EMAIL'
    | 'IN_APP'
    | 'PUSH';
  status:
    NotificationStatus;
  subject:
    string | null;
  title:
    string | null;
  body:
    string;
  template:
    string | null;
  templateData:
    unknown;
  idempotencyKey:
    string;
  failedAt:
    Date | null;
  failureReason:
    string | null;
};

type MockOutboxEventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'DEAD_LETTER';

type MockOutboxEvent = {
  id:
    string;
  aggregateType:
    string;
  aggregateId:
    string;
  eventType:
    string;
  dedupeKey:
    string;
  payload:
    unknown;
  status:
    MockOutboxEventStatus;
  attempts:
    number;
};

function createNotification(
  overrides:
    Partial<MockNotification> = {},
): MockNotification {
  return {
    id:
      'notification-db-001',

    notificationId:
      'notification-001',

    userId:
      'user-001',

    channel:
      'EMAIL',

    status:
      'FAILED',

    subject:
      'Subject',

    title:
      'Title',

    body:
      'Body',

    template:
      null,

    templateData:
      null,

    idempotencyKey:
      'idempotency-001',

    failedAt:
      new Date(),

    failureReason:
      'Provider failure',

    ...overrides,
  };
}

function createOutboxEvent(
  overrides:
    Partial<MockOutboxEvent> = {},
): MockOutboxEvent {
  return {
    id:
      'outbox-001',

    aggregateType:
      'Notification',

    aggregateId:
      'notification-db-001',

    eventType:
      'notification.enqueue',

    dedupeKey:
      'notification-retry:notification-001:retry-001',

    payload: {
      notificationId:
        'notification-001',

      channel:
        'email',

      recipient: {
        userId:
          'user-001',
      },

      body:
        'Body',

      idempotencyKey:
        'idempotency-001',
    },

    status:
      'PENDING',

    attempts:
      0,

    ...overrides,
  };
}

function createHarness(
  initialNotification:
    MockNotification | null,

  initialEvents:
    MockOutboxEvent[] = [],
) {
  let notification =
    initialNotification;

  const events =
    [...initialEvents];

  let onOutboxCreated:
    (() => void) | undefined;

  const notificationFindUnique =
    vi.fn(
      async () =>
        notification,
    );

  const outboxFindFirst =
    vi.fn(
      async () => {
        const currentNotification =
          notification;

        if (
          currentNotification ===
          null
        ) {
          return null;
        }

        return (
          events.find(
            (
              event,
            ) =>
              event.aggregateType ===
                'Notification' &&
              event.aggregateId ===
                currentNotification.id &&
              event.eventType ===
                'notification.enqueue' &&
              (
                event.status ===
                  'PENDING' ||
                event.status ===
                  'PROCESSING'
              ),
          ) ?? null
        );
      },
    );

  const notificationUpdateMany =
    vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          id:
            string;

          status:
            NotificationStatus;
        };

        data: {
          status:
            NotificationStatus;

          failedAt:
            Date | null;

          failureReason:
            string | null;
        };
      }) => {
        const currentNotification =
          notification;

        if (
          currentNotification ===
            null ||
          currentNotification.id !==
            where.id ||
          currentNotification.status !==
            where.status
        ) {
          return {
            count:
              0,
          };
        }

        notification = {
          ...currentNotification,

          status:
            data.status,

          failedAt:
            data.failedAt,

          failureReason:
            data.failureReason,
        };

        return {
          count:
            1,
        };
      },
    );

  const outboxCreate =
    vi.fn(
      async ({
        data,
      }: {
        data: {
          eventType:
            string;

          aggregateType:
            string;

          aggregateId:
            string;

          dedupeKey:
            string;

          payload:
            unknown;

          status:
            MockOutboxEventStatus;

          attempts:
            number;
        };
      }) => {
        const event =
          createOutboxEvent({
            id:
              `outbox-${events.length + 1}`,

            aggregateType:
              data.aggregateType,

            aggregateId:
              data.aggregateId,

            eventType:
              data.eventType,

            dedupeKey:
              data.dedupeKey,

            payload:
              data.payload,

            status:
              data.status,

            attempts:
              data.attempts,
          });

        events.push(
          event,
        );

        onOutboxCreated?.();

        return event;
      },
    );

  const transaction =
    vi.fn(
      async (
        callback: (
          tx: {
            notification: {
              updateMany:
                typeof notificationUpdateMany;
            };

            outboxEvent: {
              findFirst:
                typeof outboxFindFirst;

              create:
                typeof outboxCreate;
            };
          },
        ) => Promise<unknown>,
      ) =>
        callback({
          notification: {
            updateMany:
              notificationUpdateMany,
          },

          outboxEvent: {
            findFirst:
              outboxFindFirst,

            create:
              outboxCreate,
          },
        }),
    );

  const prisma = {
    notification: {
      findUnique:
        notificationFindUnique,
    },

    outboxEvent: {
      findFirst:
        outboxFindFirst,
    },

    $transaction:
      transaction,
  };

  return {
    prisma:
      prisma as never,

    notificationFindUnique,

    outboxFindFirst,

    notificationUpdateMany,

    outboxCreate,

    transaction,

    getNotification:
      () =>
        notification,

    getEvents:
      () =>
        [...events],

    setNotification:
      (
        nextNotification:
          MockNotification,
      ) => {
        notification =
          nextNotification;
      },

    setOutboxStatus:
      (
        outboxId:
          string,

        status:
          MockOutboxEventStatus,
      ) => {
        const event =
          events.find(
            (
              item,
            ) =>
              item.id ===
              outboxId,
          );

        if (
          !event
        ) {
          throw new Error(
            `Outbox event ${outboxId} was not found.`,
          );
        }

        event.status =
          status;
      },

    setOnOutboxCreated:
      (
        callback:
          () => void,
      ) => {
        onOutboxCreated =
          callback;
      },
  };
}

describe(
  'NotificationOperationalService',
  () => {
    it(
      'returns 404 for an unknown notification',
      async () => {
        const harness =
          createHarness(
            null,
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.retry(
            'missing-notification',
          ),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );

        expect(
          harness.notificationUpdateMany,
        ).not.toHaveBeenCalled();

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects retry for SENT notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'SENT',

              failedAt:
                null,

              failureReason:
                null,
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.retry(
            'notification-001',
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          harness.notificationUpdateMany,
        ).not.toHaveBeenCalled();

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects retry for PROCESSING notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'PROCESSING',

              failedAt:
                null,

              failureReason:
                null,
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.retry(
            'notification-001',
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects retry for QUEUED notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'QUEUED',

              failedAt:
                null,

              failureReason:
                null,
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.retry(
            'notification-001',
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'schedules exactly one retry from FAILED',
      async () => {
        const harness =
          createHarness(
            createNotification(),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const result =
          await service.retry(
            'notification-001',
          );

        expect(
          result.accepted,
        ).toBe(
          true,
        );

        expect(
          result.action,
        ).toBe(
          'retry-scheduled',
        );

        expect(
          harness.notificationUpdateMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          harness.getNotification()
            ?.status,
        ).toBe(
          'RETRYING',
        );

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          harness.getEvents(),
        ).toHaveLength(
          1,
        );

        expect(
          harness.getEvents()[0]
            ?.status,
        ).toBe(
          'PENDING',
        );
      },
    );

    it(
      'returns the existing retry when status is RETRYING and an active retry exists',
      async () => {
        const existing =
          createOutboxEvent();

        const harness =
          createHarness(
            createNotification({
              status:
                'RETRYING',

              failedAt:
                null,

              failureReason:
                null,
            }),

            [
              existing,
            ],
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const result =
          await service.retry(
            'notification-001',
          );

        expect(
          result.accepted,
        ).toBe(
          true,
        );

        expect(
          result.action,
        ).toBe(
          'retry-already-scheduled',
        );

        expect(
          result.outboxEventId,
        ).toBe(
          existing.id,
        );

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects an inconsistent RETRYING state without an active retry',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'RETRYING',

              failedAt:
                null,

              failureReason:
                null,
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.retry(
            'notification-001',
          ),
        ).rejects.toThrow(
          'marked RETRYING but has no pending retry operation.',
        );

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'allows a later retry after the previous retry reaches a terminal outbox state',
      async () => {
        const harness =
          createHarness(
            createNotification(),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const first =
          await service.retry(
            'notification-001',
          );

        expect(
          first.accepted,
        ).toBe(
          true,
        );

        expect(
          first.action,
        ).toBe(
          'retry-scheduled',
        );

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        const firstEvent =
          harness.getEvents()[0];

        expect(
          firstEvent,
        ).toBeDefined();

        if (
          !firstEvent
        ) {
          throw new Error(
            'Expected first retry outbox event to exist.',
          );
        }

        harness.setOutboxStatus(
          firstEvent.id,
          'PUBLISHED',
        );

        harness.setNotification(
          createNotification({
            status:
              'FAILED',

            failedAt:
              new Date(),

            failureReason:
              'Second provider failure',
          }),
        );

        const second =
          await service.retry(
            'notification-001',
          );

        expect(
          second.accepted,
        ).toBe(
          true,
        );

        expect(
          second.action,
        ).toBe(
          'retry-scheduled',
        );

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          2,
        );

        const finalEvents =
          harness.getEvents();

        expect(
          finalEvents,
        ).toHaveLength(
          2,
        );

        expect(
          finalEvents[0]?.status,
        ).toBe(
          'PUBLISHED',
        );

        expect(
          finalEvents[1]?.status,
        ).toBe(
          'PENDING',
        );

        expect(
          finalEvents[0]?.dedupeKey,
        ).not.toBe(
          finalEvents[1]?.dedupeKey,
        );

        expect(
          finalEvents[1]?.dedupeKey,
        ).toMatch(
          /^notification-retry:notification-001:/,
        );
      },
    );

    it(
      'preserves the original idempotency key in the retry payload',
      async () => {
        const harness =
          createHarness(
            createNotification(),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await service.retry(
          'notification-001',
        );

        const event =
          harness.getEvents()[0];

        expect(
          event,
        ).toBeDefined();

        expect(
          event?.payload,
        ).toMatchObject({
          notificationId:
            'notification-001',

          idempotencyKey:
            'idempotency-001',

          body:
            'Body',

          channel:
            'email',

          recipient: {
            userId:
              'user-001',
          },
        });
      },
    );

    it(
      'collapses concurrent retry requests into one retry operation',
      async () => {
        const harness =
          createHarness(
            createNotification(),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        let releaseFirstUpdate:
          (() => void) | undefined;

        const firstUpdateReached =
          new Promise<void>(
            (
              resolve,
            ) => {
              releaseFirstUpdate =
                resolve;
            },
          );

        let resolveFirstOutbox:
          (() => void) | undefined;

        const firstOutboxCreated =
          new Promise<void>(
            (
              resolve,
            ) => {
              resolveFirstOutbox =
                resolve;
            },
          );

        harness.setOnOutboxCreated(
          () => {
            resolveFirstOutbox?.();
          },
        );

        let updateCalls =
          0;

        harness.notificationUpdateMany
          .mockImplementation(
            async ({
              data,
            }) => {
              updateCalls +=
                1;

              /*
               * First transaction wins the atomic
               * FAILED -> RETRYING state transition.
               */
              if (
                updateCalls ===
                1
              ) {
                await firstUpdateReached;

                const current =
                  harness.getNotification();

                if (
                  current
                ) {
                  harness.setNotification({
                    ...current,

                    status:
                      data.status,

                    failedAt:
                      data.failedAt,

                    failureReason:
                      data.failureReason,
                  });
                }

                return {
                  count:
                    1,
                };
              }

              /*
               * The second transaction must wait until the
               * first retry has actually created its outbox
               * event. It then loses the compare-and-set.
               */
              await firstOutboxCreated;

              return {
                count:
                  0,
              };
            },
          );

        const firstRetry =
          service.retry(
            'notification-001',
          );

        const secondRetry =
          service.retry(
            'notification-001',
          );

        releaseFirstUpdate?.();

        const results =
          await Promise.allSettled([
            firstRetry,
            secondRetry,
          ]);

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          harness.getEvents(),
        ).toHaveLength(
          1,
        );

        const successful =
          results.filter(
            (
              result,
            ) =>
              result.status ===
              'fulfilled',
          );

        expect(
          successful,
        ).toHaveLength(
          2,
        );

        const outboxIds =
          successful.map(
            (
              result,
            ) =>
              result.status ===
              'fulfilled'
                ? result.value
                    .outboxEventId
                : undefined,
          );

        expect(
          new Set(
            outboxIds,
          ).size,
        ).toBe(
          1,
        );

        expect(
          outboxIds[0],
        ).toBe(
          harness.getEvents()[0]
            ?.id,
        );
      },
    );
  },
);