import { describe, expect, it, vi } from 'vitest';

import type { NotificationJobData } from '../processors/notification.processor.js';

import {
  getNotificationRetryPolicy,
  NOTIFICATION_RETRY_BACKOFF_TYPE,
} from '../notifications/notification-retry.policy.js';

import { NotificationOutboxDispatchHandler } from './notification-outbox-dispatch.handler.js';

interface QueueMock {
  add: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createQueue(): QueueMock {
  return {
    add: vi.fn().mockResolvedValue({
      id: 'job-001',
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    notificationId: 'notification-001',
    channel: 'email',
    recipient: {
      userId: 'user-001',
      email: 'student@example.com',
      deviceTokens: ['device-token-001'],
    },
    body: 'Course update available.',
    idempotencyKey: 'notification-001',
    ...overrides,
  };
}

describe('NotificationOutboxDispatchHandler', () => {
  it('publishes a valid email notification with the complete normalized job data', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    const payload = createPayload({
      deliveryKey: 'delivery-001',
      subject: 'Course update',
      title: 'Gurusthalam',
      template: 'course-updated',
      templateData: {
        courseId: 'course-001',
        version: 3,
        published: true,
        metadata: {
          level: 'advanced',
        },
        tags: ['course', 'update'],
      },
    });

    await handler.dispatch(payload);

    expect(queue.add).toHaveBeenCalledTimes(1);

    const [jobName, data, options] = queue.add.mock.calls[0] as [
      string,
      NotificationJobData,
      Record<string, unknown>,
    ];

    expect(jobName).toBe('notification:email');

    expect(data).toEqual({
      notificationId: 'notification-001',
      channel: 'email',
      recipient: {
        userId: 'user-001',
        email: 'student@example.com',
        deviceTokens: ['device-token-001'],
      },
      body: 'Course update available.',
      idempotencyKey: 'notification-001',
      deliveryKey: 'delivery-001',
      subject: 'Course update',
      title: 'Gurusthalam',
      template: 'course-updated',
      templateData: {
        courseId: 'course-001',
        version: 3,
        published: true,
        metadata: {
          level: 'advanced',
        },
        tags: ['course', 'update'],
      },
    });

    expect(options).toEqual({
      jobId: 'notification-001',
      attempts: getNotificationRetryPolicy().maxAttempts,
      backoff: {
        type: NOTIFICATION_RETRY_BACKOFF_TYPE,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  });

  it.each([
    ['in-app', 'notification:in-app'],
    ['push', 'notification:push'],
  ] as const)(
    'routes a valid %s notification to the corresponding BullMQ job name',
    async (channel, expectedJobName) => {
      const queue = createQueue();

      const handler = new NotificationOutboxDispatchHandler(queue as never);

      await handler.dispatch(
        createPayload({
          channel,
        }),
      );

      expect(queue.add).toHaveBeenCalledTimes(1);

      expect(queue.add.mock.calls[0]?.[0]).toBe(expectedJobName);

      expect(queue.add.mock.calls[0]?.[1]).toMatchObject({
        channel,
        idempotencyKey: 'notification-001',
      });
    },
  );

  it('preserves deterministic notification identity as the BullMQ job ID', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.dispatch(
      createPayload({
        idempotencyKey: 'stable-notification-identity',
      }),
    );

    const options = queue.add.mock.calls[0]?.[2] as {
      jobId: string;
    };

    expect(options.jobId).toBe('stable-notification-identity');
  });

  it('applies the centralized notification retry policy independently of Outbox retry', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.dispatch(createPayload());

    const options = queue.add.mock.calls[0]?.[2] as {
      attempts: number;
      backoff: {
        type: string;
      };
    };

    expect(options.attempts).toBe(getNotificationRetryPolicy().maxAttempts);

    expect(options.backoff).toEqual({
      type: NOTIFICATION_RETRY_BACKOFF_TYPE,
    });
  });

  it('preserves optional delivery and presentation fields without manufacturing absent fields', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.dispatch(
      createPayload({
        deliveryKey: 'delivery-002',
        subject: 'Subject',
        title: 'Title',
        template: 'template-key',
        templateData: {
          value: 'data',
        },
      }),
    );

    const data = queue.add.mock.calls[0]?.[1] as NotificationJobData;

    expect(data.deliveryKey).toBe('delivery-002');
    expect(data.subject).toBe('Subject');
    expect(data.title).toBe('Title');
    expect(data.template).toBe('template-key');
    expect(data.templateData).toEqual({
      value: 'data',
    });
  });

  it('preserves a recipient with only its required user ID', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.dispatch(
      createPayload({
        recipient: {
          userId: 'user-only',
        },
      }),
    );

    const data = queue.add.mock.calls[0]?.[1] as NotificationJobData;

    expect(data.recipient).toEqual({
      userId: 'user-only',
    });
  });

  it('preserves recipient email and multiple device tokens', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.dispatch(
      createPayload({
        channel: 'push',
        recipient: {
          userId: 'user-002',
          email: 'student@example.com',
          deviceTokens: ['token-001', 'token-002'],
        },
      }),
    );

    const data = queue.add.mock.calls[0]?.[1] as NotificationJobData;

    expect(data.recipient).toEqual({
      userId: 'user-002',
      email: 'student@example.com',
      deviceTokens: ['token-001', 'token-002'],
    });
  });

  it('preserves nested JSON template data without reconstruction loss', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    const templateData = {
      course: {
        id: 'course-001',
        title: 'Physics',
        stats: {
          lessons: 12,
          published: true,
        },
      },
      labels: ['science', 'physics'],
      nullable: null,
    };

    await handler.dispatch(
      createPayload({
        templateData,
      }),
    );

    const data = queue.add.mock.calls[0]?.[1] as NotificationJobData;

    expect(data.templateData).toEqual(templateData);
  });

  it('rejects a non-object notification payload before queue publication', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(handler.dispatch(null)).rejects.toThrow(
      'Invalid notification outbox payload.',
    );

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an array notification payload before queue publication', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(handler.dispatch([])).rejects.toThrow(
      'Invalid notification outbox payload.',
    );

    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    [
      'notificationId',
      {
        notificationId: '',
      },
    ],
    [
      'idempotencyKey',
      {
        idempotencyKey: '   ',
      },
    ],
    [
      'body',
      {
        body: '',
      },
    ],
  ] as const)('rejects an invalid required %s', async (_field, override) => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(handler.dispatch(createPayload(override))).rejects.toThrow();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an unsupported notification channel', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          channel: 'sms',
        }),
      ),
    ).rejects.toThrow('Outbox payload channel is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid recipient object', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          recipient: null,
        }),
      ),
    ).rejects.toThrow('Outbox payload recipient is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid recipient user ID', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          recipient: {
            userId: '   ',
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload userId is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid recipient email', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          recipient: {
            userId: 'user-001',
            email: '',
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload recipient.email is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid device-token collection', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          recipient: {
            userId: 'user-001',
            deviceTokens: 'not-an-array',
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload recipient.deviceTokens is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid device token value', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          recipient: {
            userId: 'user-001',
            deviceTokens: ['token-001', ''],
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload recipient.deviceTokens is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    [
      'deliveryKey',
      {
        deliveryKey: '',
      },
    ],
    [
      'subject',
      {
        subject: '',
      },
    ],
    [
      'title',
      {
        title: '',
      },
    ],
    [
      'template',
      {
        template: '',
      },
    ],
  ] as const)('rejects an invalid optional %s', async (_field, override) => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(handler.dispatch(createPayload(override))).rejects.toThrow();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects invalid template data', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          templateData: {
            valid: 'value',
            invalid: undefined,
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload templateData is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects non-JSON template data values', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(
      handler.dispatch(
        createPayload({
          templateData: {
            invalid: new Date(),
          },
        }),
      ),
    ).rejects.toThrow('Outbox payload templateData is invalid.');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not publish when queue.add fails', async () => {
    const queue = createQueue();

    const queueError = new Error('BullMQ unavailable');

    queue.add.mockRejectedValueOnce(queueError);

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await expect(handler.dispatch(createPayload())).rejects.toThrow(
      'BullMQ unavailable',
    );

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('closes the underlying BullMQ queue during shutdown', async () => {
    const queue = createQueue();

    const handler = new NotificationOutboxDispatchHandler(queue as never);

    await handler.close();

    expect(queue.close).toHaveBeenCalledTimes(1);
  });
});
