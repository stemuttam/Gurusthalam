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
  id:
    string;

  notificationId:
    string;

  userId:
    string;

  channel:
    'EMAIL'
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
};

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
    'PENDING'
    | 'PROCESSING'
    | 'PUBLISHED'
    | 'FAILED'
    | 'DEAD_LETTER';

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
      'SENT',

    subject:
      'Welcome',

    title:
      'Welcome',

    body:
      'Welcome to Gurusthalam.',

    template:
      null,

    templateData:
      null,

    idempotencyKey:
      'original-idempotency-001',

    ...overrides,
  };
}

function createHarness(
  notification:
    MockNotification | null,
) {
  let nextOutboxNumber =
    1;

  const createdEvents:
    MockOutboxEvent[] = [];

  const findUnique =
    vi.fn(
      async () =>
        notification,
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
            MockOutboxEvent['status'];

          attempts:
            number;
        };
      }) => {
        const event:
          MockOutboxEvent = {
          id:
            `outbox-${nextOutboxNumber++}`,

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
        };

        createdEvents.push(
          event,
        );

        return event;
      },
    );

  const prisma = {
    notification: {
      findUnique,
    },

    outboxEvent: {
      create:
        outboxCreate,
    },
  };

  return {
    prisma:
      prisma as never,

    findUnique,

    outboxCreate,

    getEvents:
      () =>
        [...createdEvents],
  };
}

describe(
  'NotificationOperationalService - replay',
  () => {
    it(
      'returns 404 when the notification does not exist',
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
          service.replay(
            'missing-notification',
          ),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );

        expect(
          harness.outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'allows replay for SENT notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'SENT',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const result =
          await service.replay(
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
          'replay-scheduled',
        );

        expect(
          result.status,
        ).toBe(
          'PENDING',
        );

        expect(
          result.notificationId,
        ).toBe(
          'notification-001',
        );

        expect(
          result.replayId,
        ).toBeTruthy();

        expect(
          result.outboxEventId,
        ).toBe(
          'outbox-1',
        );

        expect(
          result.idempotencyKey,
        ).toMatch(
          /^notification-replay:notification-001:/,
        );

        expect(
          result.deliveryKey,
        ).toBeTruthy();

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'allows replay for FAILED notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'FAILED',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const result =
          await service.replay(
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
          'replay-scheduled',
        );

        expect(
          harness.outboxCreate,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'rejects replay for QUEUED notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'QUEUED',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.replay(
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
      'rejects replay for PROCESSING notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'PROCESSING',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.replay(
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
      'rejects replay for RETRYING notifications',
      async () => {
        const harness =
          createHarness(
            createNotification({
              status:
                'RETRYING',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await expect(
          service.replay(
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
      'creates a new idempotency key and delivery key for every replay',
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
          await service.replay(
            'notification-001',
          );

        const second =
          await service.replay(
            'notification-001',
          );

        expect(
          first.idempotencyKey,
        ).not.toBe(
          second.idempotencyKey,
        );

        expect(
          first.deliveryKey,
        ).not.toBe(
          second.deliveryKey,
        );

        expect(
          first.replayId,
        ).not.toBe(
          second.replayId,
        );

        expect(
          first.outboxEventId,
        ).not.toBe(
          second.outboxEventId,
        );

        expect(
          harness.getEvents(),
        ).toHaveLength(
          2,
        );
      },
    );

    it(
      'does not modify the original notification identity',
      async () => {
        const original =
          createNotification();

        const harness =
          createHarness(
            original,
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        await service.replay(
          original.notificationId,
        );

        expect(
          harness.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            notificationId:
              original.notificationId,
          },
        });

        expect(
          original.notificationId,
        ).toBe(
          'notification-001',
        );

        expect(
          original.idempotencyKey,
        ).toBe(
          'original-idempotency-001',
        );

        expect(
          original.status,
        ).toBe(
          'SENT',
        );
      },
    );

    it(
      'creates a replay outbox payload with a new delivery identity',
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
          await service.replay(
            'notification-001',
          );

        const event =
          harness.getEvents()[0];

        expect(
          event,
        ).toBeDefined();

        expect(
          event?.aggregateType,
        ).toBe(
          'Notification',
        );

        expect(
          event?.aggregateId,
        ).toBe(
          'notification-db-001',
        );

        expect(
          event?.eventType,
        ).toBe(
          'notification.enqueue',
        );

        expect(
          event?.status,
        ).toBe(
          'PENDING',
        );

        expect(
          event?.dedupeKey,
        ).toBe(
          `notification-replay:notification-001:${result.replayId}`,
        );

        expect(
          event?.payload,
        ).toMatchObject({
          notificationId:
            'notification-001',

          channel:
            'email',

          recipient: {
            userId:
              'user-001',
          },

          idempotencyKey:
            result.idempotencyKey,

          deliveryKey:
            result.deliveryKey,
        });
      },
    );

    it(
      'preserves the original logical notification idempotency key separately from replay identity',
      async () => {
        const harness =
          createHarness(
            createNotification({
              idempotencyKey:
                'original-key-123',
            }),
          );

        const service =
          new NotificationOperationalService(
            harness.prisma,
          );

        const result =
          await service.replay(
            'notification-001',
          );

        expect(
          result.idempotencyKey,
        ).not.toBe(
          'original-key-123',
        );

        expect(
          result.idempotencyKey,
        ).toMatch(
          /^notification-replay:notification-001:/,
        );
      },
    );
  },
);