import { randomUUID } from 'node:crypto';

import { Queue, type Job } from 'bullmq';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getRedisConfig } from '@gurusthalam/config';

import type { NotificationJobData } from '../processors/notification.processor.js';

import { QUEUE_NAMES, QUEUE_PREFIX } from '../queues/queue.constants.js';

import {
  getNotificationRetryPolicy,
  NOTIFICATION_RETRY_BACKOFF_TYPE,
} from '../notifications/notification-retry.policy.js';

import { NotificationOutboxDispatchHandler } from './notification-outbox-dispatch.handler.js';

const REDIS_URL = process.env.REDIS_URL;

const describeRedis = REDIS_URL ? describe : describe.skip;

function createNotificationPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const notificationId = `redis-notification-${randomUUID()}`;

  return {
    notificationId,

    channel: 'email',

    recipient: {
      userId: `redis-user-${randomUUID()}`,
      email: 'redis-integration@example.com',
      deviceTokens: ['redis-device-token-001', 'redis-device-token-002'],
    },

    subject: 'Gurusthalam Notification Integration',

    title: 'Notification Integration',

    body: 'Production Redis/BullMQ integration verification.',

    template: 'course-notification',

    templateData: {
      courseId: `redis-course-${randomUUID()}`,

      version: 4,

      published: true,

      metadata: {
        source: 'notification-outbox-redis-integration',
        environment: 'test',
      },

      tags: ['course', 'notification', 'integration'],
    },

    idempotencyKey: notificationId,

    deliveryKey: `redis-delivery-${randomUUID()}`,

    ...overrides,
  };
}

function getJobId(payload: Record<string, unknown>): string {
  return String(payload.idempotencyKey);
}

function createObserverQueue(): Queue<NotificationJobData> {
  const redis = getRedisConfig();

  return new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
    connection: {
      url: redis.url,
    },

    prefix: QUEUE_PREFIX,
  });
}

describeRedis(
  'Notification Outbox Dispatch Handler - Redis/BullMQ integration',
  () => {
    let handler: NotificationOutboxDispatchHandler;

    let observerQueue: Queue<NotificationJobData>;

    const createdJobIds: string[] = [];

    beforeAll(async () => {
      handler = NotificationOutboxDispatchHandler.fromRedisConfig();

      observerQueue = createObserverQueue();

      await observerQueue.waitUntilReady();
    });

    afterAll(async () => {
      for (const jobId of createdJobIds) {
        await observerQueue.remove(jobId);
      }

      await handler.close();

      await observerQueue.close();
    });

    it('publishes a real Notification job through the production Redis/BullMQ boundary', async () => {
      const payload = createNotificationPayload();

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.id).toBe(jobId);

      expect(job?.name).toBe('notification:email');
    });

    it('preserves the complete Notification job payload in the real BullMQ job', async () => {
      const payload = createNotificationPayload();

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data).toEqual({
        notificationId: payload.notificationId,

        channel: payload.channel,

        recipient: payload.recipient,

        subject: payload.subject,

        title: payload.title,

        body: payload.body,

        template: payload.template,

        templateData: payload.templateData,

        idempotencyKey: payload.idempotencyKey,

        deliveryKey: payload.deliveryKey,
      });
    });

    it.each([
      ['email', 'notification:email'],
      ['in-app', 'notification:in-app'],
      ['push', 'notification:push'],
    ] as const)(
      'routes a real %s Notification to the canonical BullMQ job name',
      async (channel, expectedJobName) => {
        const payload = createNotificationPayload({
          channel,
        });

        const jobId = getJobId(payload);

        createdJobIds.push(jobId);

        await handler.dispatch(payload);

        const job = await observerQueue.getJob(jobId);

        expect(job).toBeDefined();

        expect(job?.id).toBe(jobId);

        expect(job?.name).toBe(expectedJobName);

        expect(job?.data.channel).toBe(channel);
      },
    );

    it('preserves the centralized Notification BullMQ retry policy in the real job', async () => {
      const payload = createNotificationPayload();

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      const policy = getNotificationRetryPolicy();

      expect(job?.opts.attempts).toBe(policy.maxAttempts);

      expect(job?.opts.backoff).toEqual({
        type: NOTIFICATION_RETRY_BACKOFF_TYPE,
      });
    });

    it('reuses the same deterministic transport identity for repeated dispatch of the same Notification', async () => {
      const payload = createNotificationPayload();

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.id).toBe(jobId);

      const jobs = await observerQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'completed',
        'failed',
      ]);

      const matchingJobs = jobs.filter(
        (candidate: Job<NotificationJobData>) => candidate.id === jobId,
      );

      expect(matchingJobs).toHaveLength(1);
    });

    it('preserves nested JSON template data without reconstruction loss', async () => {
      const templateData = {
        course: {
          id: 'course-redis-001',

          title: 'Physics',

          statistics: {
            lessons: 24,

            published: true,

            completionRate: 0.875,
          },
        },

        labels: ['science', 'physics', 'course'],

        nullable: null,

        flags: {
          featured: false,
          notificationRequired: true,
        },
      };

      const payload = createNotificationPayload({
        templateData,
      });

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data.templateData).toEqual(templateData);
    });

    it('preserves optional Notification fields when they are absent', async () => {
      const payload = createNotificationPayload();

      delete payload.deliveryKey;

      delete payload.subject;

      delete payload.title;

      delete payload.template;

      delete payload.templateData;

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data).toEqual({
        notificationId: payload.notificationId,

        channel: payload.channel,

        recipient: payload.recipient,

        body: payload.body,

        idempotencyKey: payload.idempotencyKey,
      });

      expect(job?.data).not.toHaveProperty('deliveryKey');

      expect(job?.data).not.toHaveProperty('subject');

      expect(job?.data).not.toHaveProperty('title');

      expect(job?.data).not.toHaveProperty('template');

      expect(job?.data).not.toHaveProperty('templateData');
    });

    it('preserves a recipient with only the required user ID', async () => {
      const payload = createNotificationPayload({
        recipient: {
          userId: `redis-user-${randomUUID()}`,
        },
      });

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await handler.dispatch(payload);

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeDefined();

      expect(job?.data.recipient).toEqual(payload.recipient);
    });

    it('keeps Notification transport isolated from malformed Course-shaped events', async () => {
      const payload = createNotificationPayload();

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      const invalidCourseEvent = {
        eventId: `course-event-${randomUUID()}`,

        eventName: 'course.created',

        eventVersion: 1,

        aggregateId: `course-${randomUUID()}`,

        occurredAt: '2026-09-27T12:30:00.000Z',

        payload: {
          courseId: `course-${randomUUID()}`,

          title: 'Invalid Course Event',

          status: 'DRAFT',
        },
      };

      await expect(handler.dispatch(invalidCourseEvent)).rejects.toThrow(
        'Outbox payload notificationId is invalid.',
      );

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeUndefined();
    });

    it('rejects an invalid Notification payload before real BullMQ publication', async () => {
      const payload = createNotificationPayload();

      delete payload.notificationId;

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await expect(handler.dispatch(payload)).rejects.toThrow(
        'Outbox payload notificationId is invalid.',
      );

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeUndefined();
    });

    it('rejects an unsupported Notification channel before real BullMQ publication', async () => {
      const payload = createNotificationPayload({
        channel: 'sms',
      });

      const jobId = getJobId(payload);

      createdJobIds.push(jobId);

      await expect(handler.dispatch(payload)).rejects.toThrow(
        'Outbox payload channel is invalid.',
      );

      const job = await observerQueue.getJob(jobId);

      expect(job).toBeUndefined();
    });
  },
);
