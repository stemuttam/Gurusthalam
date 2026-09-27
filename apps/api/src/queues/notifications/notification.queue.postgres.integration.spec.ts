import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../database/prisma/prisma.service.js';

import { NotificationQueueService } from './notification.queue.js';

import type {
  NotificationJobData,
  NotificationTemplateSnapshot,
} from './notification.types.js';

interface FakeRenderedNotification {
  readonly templateId: string;
  readonly version: number;
  readonly locale: string;
  readonly rendered: {
    readonly subject?: string;
    readonly title?: string;
    readonly body: string;
  };
  readonly templateData: NonNullable<NotificationJobData['templateData']>;
  readonly snapshot: NotificationTemplateSnapshot;
}

const fakeTemplateService = {
  async renderPublishedVersion(
    templateId: string,
    templateData: NonNullable<NotificationJobData['templateData']>,
    locale?: string,
  ): Promise<FakeRenderedNotification> {
    const resolvedLocale = locale ?? 'en-US';

    return {
      templateId,
      version: 1,
      locale: resolvedLocale,
      rendered: {
        subject: 'Phase 4.13-B transactional integration',
        title: 'Notification Outbox Integration',
        body: 'Notification and Outbox must commit atomically.',
      },
      templateData,
      snapshot: {
        templateId,
        version: 1,
        locale: resolvedLocale,
        subject: 'Phase 4.13-B transactional integration',
        title: 'Notification Outbox Integration',
        body: 'Notification and Outbox must commit atomically.',
        variables: [
          {
            path: 'courseId',
            required: true,
            type: 'string',
          },
          {
            path: 'courseTitle',
            required: true,
            type: 'string',
          },
          {
            path: 'metadata',
            required: false,
            type: 'object',
          },
        ],
      },
    };
  },
} as never;

describe('NotificationQueueService - PostgreSQL transactional Outbox integration', () => {
  const prisma = new PrismaService();

  const queue = new NotificationQueueService(prisma, fakeTemplateService);

  const testPrefix = `phase-4-13-b-${randomUUID()}`;

  const createdNotificationIds: string[] = [];

  const createdOutboxIds: string[] = [];

  const createdConflictOutboxIds: string[] = [];

  beforeAll(async () => {
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    if (createdOutboxIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          id: {
            in: createdOutboxIds,
          },
        },
      });
    }

    if (createdConflictOutboxIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          id: {
            in: createdConflictOutboxIds,
          },
        },
      });
    }

    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          id: {
            in: createdNotificationIds,
          },
        },
      });
    }

    createdNotificationIds.length = 0;
    createdOutboxIds.length = 0;
    createdConflictOutboxIds.length = 0;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  function createNotificationData(suffix: string): NotificationJobData {
    const identity = `${testPrefix}-${suffix}`;

    return {
      notificationId: `${identity}-notification`,
      channel: 'email',
      recipient: {
        userId: `${identity}-user`,
        email: `${identity}@example.com`,
      },
      subject: 'Phase 4.13-B transactional integration',
      title: 'Notification Outbox Integration',
      body: 'Notification and Outbox must commit atomically.',
      template: 'course.published',
      templateData: {
        courseId: `${identity}-course`,
        courseTitle: 'Transactional Course',
        metadata: {
          source: 'phase-4-13-b',
          nested: {
            enabled: true,
            sequence: [1, 2, 3],
          },
        },
      },
      idempotencyKey: `${identity}-idempotency`,
    };
  }

  function createLiteralNotificationData(
    data: NotificationJobData,
  ): NotificationJobData {
    return {
      notificationId: data.notificationId,
      channel: data.channel,
      recipient: data.recipient,
      ...(data.subject !== undefined
        ? {
            subject: data.subject,
          }
        : {}),
      ...(data.title !== undefined
        ? {
            title: data.title,
          }
        : {}),
      body: data.body,
      idempotencyKey: data.idempotencyKey,
    };
  }

  function createExpectedResolvedTemplateData(
    data: NotificationJobData,
  ): NotificationJobData {
    if (data.template === undefined || data.templateData === undefined) {
      throw new Error(
        'Expected a template-backed NotificationJobData fixture.',
      );
    }

    return {
      notificationId: data.notificationId,
      channel: data.channel,
      recipient: data.recipient,
      subject: 'Phase 4.13-B transactional integration',
      title: 'Notification Outbox Integration',
      body: 'Notification and Outbox must commit atomically.',
      template: 'course.published',
      templateVersion: 1,
      templateLocale: 'en-US',
      templateData: data.templateData,
      templateSnapshot: {
        templateId: 'course.published',
        version: 1,
        locale: 'en-US',
        subject: 'Phase 4.13-B transactional integration',
        title: 'Notification Outbox Integration',
        body: 'Notification and Outbox must commit atomically.',
        variables: [
          {
            path: 'courseId',
            required: true,
            type: 'string',
          },
          {
            path: 'courseTitle',
            required: true,
            type: 'string',
          },
          {
            path: 'metadata',
            required: false,
            type: 'object',
          },
        ],
      },
      idempotencyKey: data.idempotencyKey,
    };
  }

  it('persists Notification and notification.enqueue Outbox event atomically', async () => {
    const data = createNotificationData('atomic-success');

    const literalData = createLiteralNotificationData(data);

    const result = await queue.enqueue(literalData);

    expect(result.notificationId).toBe(literalData.notificationId);

    expect(result.status).toBe('QUEUED');

    expect(result.jobId).toBe(literalData.idempotencyKey);

    expect(result.outboxEventId).not.toBe('');

    createdOutboxIds.push(result.outboxEventId);

    const notification = await prisma.notification.findUnique({
      where: {
        notificationId: literalData.notificationId,
      },
    });

    expect(notification).not.toBeNull();

    if (notification === null) {
      throw new Error('Expected persisted Notification record.');
    }

    createdNotificationIds.push(notification.id);

    expect(notification.notificationId).toBe(literalData.notificationId);

    expect(notification.userId).toBe(literalData.recipient.userId);

    expect(String(notification.channel)).toBe('EMAIL');

    expect(String(notification.status)).toBe('QUEUED');

    expect(notification.subject).toBe(literalData.subject);

    expect(notification.title).toBe(literalData.title);

    expect(notification.body).toBe(literalData.body);

    expect(notification.template).toBeNull();

    expect(notification.templateVersion).toBeNull();

    expect(notification.templateLocale).toBeNull();

    expect(notification.templateSnapshot).toBeNull();

    expect(notification.templateData).toBeNull();

    expect(notification.idempotencyKey).toBe(literalData.idempotencyKey);

    expect(notification.attempts).toBe(0);

    const outbox = await prisma.outboxEvent.findUnique({
      where: {
        id: result.outboxEventId,
      },
    });

    expect(outbox).not.toBeNull();

    if (outbox === null) {
      throw new Error('Expected persisted Notification Outbox event.');
    }

    expect(outbox.eventType).toBe('notification.enqueue');

    expect(outbox.aggregateType).toBe('Notification');

    expect(outbox.aggregateId).toBe(notification.id);

    expect(outbox.dedupeKey).toBe(`notification:${literalData.idempotencyKey}`);

    expect(String(outbox.status)).toBe('PENDING');

    expect(outbox.attempts).toBe(0);

    expect(outbox.payload).toEqual(literalData);
  });

  it('preserves the complete resolved Notification payload inside the durable Outbox event', async () => {
    const data = createNotificationData('payload-preservation');

    const expectedResolvedData = createExpectedResolvedTemplateData(data);

    const result = await queue.enqueue(data);

    createdOutboxIds.push(result.outboxEventId);

    const notification = await prisma.notification.findUnique({
      where: {
        notificationId: data.notificationId,
      },
      select: {
        id: true,
        notificationId: true,
        template: true,
        templateVersion: true,
        templateLocale: true,
        templateSnapshot: true,
        templateData: true,
        subject: true,
        title: true,
        body: true,
      },
    });

    expect(notification).not.toBeNull();

    if (notification === null) {
      throw new Error('Expected persisted Notification record.');
    }

    createdNotificationIds.push(notification.id);

    expect(notification.notificationId).toBe(
      expectedResolvedData.notificationId,
    );

    expect(notification.template).toBe(expectedResolvedData.template);

    expect(notification.templateVersion).toBe(
      expectedResolvedData.templateVersion,
    );

    expect(notification.templateLocale).toBe(
      expectedResolvedData.templateLocale,
    );

    expect(notification.templateSnapshot).toEqual(
      expectedResolvedData.templateSnapshot,
    );

    expect(notification.templateData).toEqual(
      expectedResolvedData.templateData,
    );

    expect(notification.subject).toBe(expectedResolvedData.subject);

    expect(notification.title).toBe(expectedResolvedData.title);

    expect(notification.body).toBe(expectedResolvedData.body);

    const outbox = await prisma.outboxEvent.findUnique({
      where: {
        id: result.outboxEventId,
      },
    });

    expect(outbox).not.toBeNull();

    if (outbox === null) {
      throw new Error('Expected persisted Notification Outbox event.');
    }

    expect(outbox.aggregateId).toBe(notification.id);

    expect(outbox.payload).toEqual(expectedResolvedData);

    expect(outbox.payload).toMatchObject({
      notificationId: expectedResolvedData.notificationId,
      channel: expectedResolvedData.channel,
      recipient: expectedResolvedData.recipient,
      subject: expectedResolvedData.subject,
      title: expectedResolvedData.title,
      body: expectedResolvedData.body,
      template: expectedResolvedData.template,
      templateVersion: expectedResolvedData.templateVersion,
      templateLocale: expectedResolvedData.templateLocale,
      templateData: expectedResolvedData.templateData,
      templateSnapshot: expectedResolvedData.templateSnapshot,
      idempotencyKey: expectedResolvedData.idempotencyKey,
    });
  });

  it('does not create duplicate Notification or Outbox state for a repeated idempotent enqueue', async () => {
    const data = createNotificationData('idempotent-repeat');

    const first = await queue.enqueue(data);

    createdOutboxIds.push(first.outboxEventId);

    const second = await queue.enqueue(data);

    expect(second).toEqual(first);

    const notifications = await prisma.notification.findMany({
      where: {
        idempotencyKey: data.idempotencyKey,
      },
      select: {
        id: true,
        notificationId: true,
        idempotencyKey: true,
        template: true,
        templateVersion: true,
        templateLocale: true,
        templateSnapshot: true,
        templateData: true,
      },
    });

    expect(notifications).toHaveLength(1);

    const notification = notifications[0];

    if (notification === undefined) {
      throw new Error('Expected one persisted Notification record.');
    }

    createdNotificationIds.push(notification.id);

    const expectedResolvedData = createExpectedResolvedTemplateData(data);

    expect(notification.template).toBe(expectedResolvedData.template);

    expect(notification.templateVersion).toBe(
      expectedResolvedData.templateVersion,
    );

    expect(notification.templateLocale).toBe(
      expectedResolvedData.templateLocale,
    );

    expect(notification.templateSnapshot).toEqual(
      expectedResolvedData.templateSnapshot,
    );

    expect(notification.templateData).toEqual(
      expectedResolvedData.templateData,
    );

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        dedupeKey: `notification:${data.idempotencyKey}`,
        eventType: 'notification.enqueue',
        aggregateType: 'Notification',
      },
      select: {
        id: true,
        aggregateId: true,
        dedupeKey: true,
      },
    });

    expect(outboxEvents).toHaveLength(1);

    const outbox = outboxEvents[0];

    if (outbox === undefined) {
      throw new Error('Expected one persisted Notification Outbox event.');
    }

    createdOutboxIds.push(outbox.id);

    expect(outbox.aggregateId).toBe(notification.id);

    expect(outbox.dedupeKey).toBe(`notification:${data.idempotencyKey}`);
  });

  it('rolls back the Notification when the Outbox insert fails inside the transaction', async () => {
    const data = createNotificationData('atomic-rollback');

    const conflictingOutbox = await prisma.outboxEvent.create({
      data: {
        eventType: 'notification.enqueue',
        aggregateType: 'Notification',
        aggregateId: `${testPrefix}-conflicting-aggregate`,
        dedupeKey: `notification:${data.idempotencyKey}`,
        payload: {
          conflict: true,
          source: 'phase-4-13-b-rollback-test',
        },
        status: 'PENDING',
        attempts: 0,
        availableAt: new Date(),
      },
    });

    createdConflictOutboxIds.push(conflictingOutbox.id);

    await expect(queue.enqueue(data)).rejects.toThrow();

    const notification = await prisma.notification.findUnique({
      where: {
        idempotencyKey: data.idempotencyKey,
      },
    });

    expect(notification).toBeNull();

    const notificationOutboxEvents = await prisma.outboxEvent.findMany({
      where: {
        dedupeKey: `notification:${data.idempotencyKey}`,
        eventType: 'notification.enqueue',
        aggregateType: 'Notification',
      },
      select: {
        id: true,
        aggregateId: true,
        dedupeKey: true,
      },
    });

    expect(notificationOutboxEvents).toHaveLength(1);

    const persistedConflict = notificationOutboxEvents[0];

    if (persistedConflict === undefined) {
      throw new Error('Expected the pre-existing conflicting Outbox record.');
    }

    expect(persistedConflict.id).toBe(conflictingOutbox.id);

    expect(persistedConflict.aggregateId).toBe(
      `${testPrefix}-conflicting-aggregate`,
    );
  });

  it('links the Outbox aggregate identity to the database Notification identity rather than the logical notificationId', async () => {
    const data = createNotificationData('aggregate-identity');

    const result = await queue.enqueue(data);

    createdOutboxIds.push(result.outboxEventId);

    const notification = await prisma.notification.findUnique({
      where: {
        notificationId: data.notificationId,
      },
      select: {
        id: true,
        notificationId: true,
        templateVersion: true,
        templateLocale: true,
        templateSnapshot: true,
      },
    });

    expect(notification).not.toBeNull();

    if (notification === null) {
      throw new Error('Expected persisted Notification record.');
    }

    createdNotificationIds.push(notification.id);

    expect(notification.templateVersion).toBe(1);

    expect(notification.templateLocale).toBe('en-US');

    expect(notification.templateSnapshot).not.toBeNull();

    const outbox = await prisma.outboxEvent.findUnique({
      where: {
        id: result.outboxEventId,
      },
      select: {
        aggregateType: true,
        aggregateId: true,
        dedupeKey: true,
        eventType: true,
      },
    });

    expect(outbox).not.toBeNull();

    if (outbox === null) {
      throw new Error('Expected persisted Notification Outbox event.');
    }

    expect(outbox.aggregateType).toBe('Notification');

    expect(outbox.aggregateId).toBe(notification.id);

    expect(outbox.aggregateId).not.toBe(notification.notificationId);

    expect(outbox.eventType).toBe('notification.enqueue');

    expect(outbox.dedupeKey).toBe(`notification:${data.idempotencyKey}`);
  });
});
