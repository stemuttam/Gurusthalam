import {
  randomUUID,
} from 'node:crypto';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

type NotificationRuntimeFixture = {
  readonly notificationDatabaseId:
    string;

  readonly notificationId:
    string;

  readonly userId:
    string;

  readonly idempotencyKey:
    string;
};

type HttpResult = {
  readonly status:
    number;

  readonly body:
    unknown;
};

const apiBaseUrl =
  process.env.API_RUNTIME_BASE_URL?.replace(
    /\/+$/,
    '',
  ) ??
  'http://127.0.0.1:3000/api';

const internalApiKey =
  process.env.INTERNAL_API_KEY;

const suitePrefix =
  `phase-3-2-10-runtime-${randomUUID()}`;

describe(
  'NotificationOperationalController - real HTTP runtime',
  () => {
    let prisma:
      PrismaService;

    beforeAll(
      async () => {
        if (
          !internalApiKey
        ) {
          throw new Error(
            'INTERNAL_API_KEY environment variable is required for operational runtime tests.',
          );
        }

        prisma =
          new PrismaService();

        await prisma.$connect();

        const probe =
          await fetch(
            `${apiBaseUrl}/internal/notifications/${suitePrefix}-missing/troubleshooting`,
            {
              method:
                'GET',

              headers: {
                'x-internal-api-key':
                  internalApiKey,
              },
            },
          );

        expect(
          probe.status,
        ).toBe(
          404,
        );
      },
      10_000,
    );

    afterAll(
      async () => {
        if (
          !prisma
        ) {
          return;
        }

        await prisma.$disconnect();
      },
    );

    async function createFixture(
      status:
        | 'SENT'
        | 'FAILED',
    ): Promise<NotificationRuntimeFixture> {
      const fixtureId =
        randomUUID();

      const notificationId =
        `${suitePrefix}-${fixtureId}-notification`;

      const userId =
        `${suitePrefix}-${fixtureId}-user`;

      const idempotencyKey =
        `${suitePrefix}-${fixtureId}-idempotency`;

      const notification =
        await prisma.notification.create({
          data: {
            notificationId,

            userId,

            channel:
              'EMAIL',

            status,

            subject:
              'Phase 3.2.10 HTTP runtime test',

            title:
              'Operational runtime test',

            body:
              'Production HTTP runtime verification.',

            template:
              null,

            idempotencyKey,

            attempts:
              1,

            queuedAt:
              new Date(),

            processingAt:
              new Date(),

            sentAt:
              status ===
              'SENT'
                ? new Date()
                : null,

            failedAt:
              status ===
              'FAILED'
                ? new Date()
                : null,

            failureReason:
              status ===
              'FAILED'
                ? 'HTTP runtime integration fixture'
                : null,

            provider:
              'integration-runtime',

            providerMessageId:
              status ===
              'SENT'
                ? `${fixtureId}-original-provider-message`
                : null,
          },
        });

      return {
        notificationDatabaseId:
          notification.id,

        notificationId,

        userId,

        idempotencyKey,
      };
    }

    async function cleanupFixture(
      fixture:
        NotificationRuntimeFixture,
    ): Promise<void> {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateId:
            fixture.notificationDatabaseId,
        },
      });

      await prisma.notificationDelivery.deleteMany({
        where: {
          notificationId:
            fixture.notificationId,
        },
      });

      await prisma.notification.deleteMany({
        where: {
          id:
            fixture.notificationDatabaseId,
        },
      });
    }

    async function post(
      path:
        string,
    ): Promise<HttpResult> {
      if (
        !internalApiKey
      ) {
        throw new Error(
          'INTERNAL_API_KEY environment variable is required.',
        );
      }

      const response =
        await fetch(
          `${apiBaseUrl}${path}`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              'x-internal-api-key':
                internalApiKey,
            },
          },
        );

      const text =
        await response.text();

      let body:
        unknown = null;

      if (
        text.length >
        0
      ) {
        try {
          body =
            JSON.parse(
              text,
            );
        } catch {
          body =
            text;
        }
      }

      return {
        status:
          response.status,

        body,
      };
    }

    async function postWithoutAuth(
      path:
        string,
    ): Promise<HttpResult> {
      const response =
        await fetch(
          `${apiBaseUrl}${path}`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },
          },
        );

      const text =
        await response.text();

      let body:
        unknown = null;

      if (
        text.length >
        0
      ) {
        try {
          body =
            JSON.parse(
              text,
            );
        } catch {
          body =
            text;
        }
      }

      return {
        status:
          response.status,

        body,
      };
    }

    it(
      'rejects retry without the internal API key',
      async () => {
        const response =
          await postWithoutAuth(
            `/internal/notifications/${encodeURIComponent(
              `${suitePrefix}-missing`,
            )}/retry`,
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          response.body,
        ).toMatchObject({
          statusCode:
            401,
        });
      },
    );

    it(
      'rejects replay without the internal API key',
      async () => {
        const response =
          await postWithoutAuth(
            `/internal/notifications/${encodeURIComponent(
              `${suitePrefix}-missing`,
            )}/replay`,
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          response.body,
        ).toMatchObject({
          statusCode:
            401,
        });
      },
    );

    it(
      'POST retry returns the real HTTP success response and persists the retry',
      async () => {
        const fixture =
          await createFixture(
            'FAILED',
          );

        try {
          const response =
            await post(
              `/internal/notifications/${encodeURIComponent(
                fixture.notificationId,
              )}/retry`,
            );

          expect(
            response.status,
          ).toBe(
            201,
          );

          expect(
            response.body,
          ).toMatchObject({
            notificationId:
              fixture.notificationId,

            accepted:
              true,

            action:
              'retry-scheduled',
          });

          const body =
            response.body as {
              readonly outboxEventId:
                string;

              readonly status:
                string;
            };

          expect(
            body.outboxEventId,
          ).toBeTruthy();

          expect(
            body.status,
          ).toBe(
            'PENDING',
          );

          const notification =
            await prisma.notification.findUnique({
              where: {
                id:
                  fixture.notificationDatabaseId,
              },
            });

          expect(
            notification,
          ).not.toBeNull();

          expect(
            [
              'RETRYING',
              'SENT',
            ],
          ).toContain(
            notification?.status,
          );

          expect(
            notification?.idempotencyKey,
          ).toBe(
            fixture.idempotencyKey,
          );

          const outbox =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  body.outboxEventId,
              },
            });

          expect(
            outbox,
          ).not.toBeNull();

          expect(
            outbox?.aggregateId,
          ).toBe(
            fixture.notificationDatabaseId,
          );

          expect(
            outbox?.eventType,
          ).toBe(
            'notification.enqueue',
          );

          expect(
            outbox?.dedupeKey,
          ).toMatch(
            new RegExp(
              `^notification-retry:${fixture.notificationId}:`,
            ),
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'POST retry is idempotent while the retry is active',
      async () => {
        const fixture =
          await createFixture(
            'FAILED',
          );

        try {
          const first =
            await post(
              `/internal/notifications/${encodeURIComponent(
                fixture.notificationId,
              )}/retry`,
            );

          expect(
            first.status,
          ).toBe(
            201,
          );

          const firstBody =
            first.body as {
              readonly outboxEventId:
                string;
            };

          expect(
            firstBody.outboxEventId,
          ).toBeTruthy();

          await prisma.notification.update({
            where: {
              id:
                fixture.notificationDatabaseId,
            },

            data: {
              status:
                'RETRYING',

              failedAt:
                null,

              failureReason:
                null,
            },
          });

          const activeOutbox =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  firstBody.outboxEventId,
              },
            });

          expect(
            activeOutbox,
          ).not.toBeNull();

          if (
            activeOutbox &&
            activeOutbox.status !==
              'PENDING' &&
            activeOutbox.status !==
              'PROCESSING'
          ) {
            await prisma.outboxEvent.update({
              where: {
                id:
                  firstBody.outboxEventId,
              },

              data: {
                status:
                  'PENDING',
              },
            });
          }

          const second =
            await post(
              `/internal/notifications/${encodeURIComponent(
                fixture.notificationId,
              )}/retry`,
            );

          expect(
            second.status,
          ).toBe(
            201,
          );

          expect(
            second.body,
          ).toMatchObject({
            notificationId:
              fixture.notificationId,

            accepted:
              true,

            action:
              'retry-already-scheduled',
          });

          const secondBody =
            second.body as {
              readonly outboxEventId:
                string;
            };

          expect(
            secondBody.outboxEventId,
          ).toBe(
            firstBody.outboxEventId,
          );

          const events =
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId:
                  fixture.notificationDatabaseId,

                eventType:
                  'notification.enqueue',
              },
            });

          expect(
            events,
          ).toHaveLength(
            1,
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'POST replay returns a new replay identity without mutating the original Notification',
      async () => {
        const fixture =
          await createFixture(
            'SENT',
          );

        try {
          const response =
            await post(
              `/internal/notifications/${encodeURIComponent(
                fixture.notificationId,
              )}/replay`,
            );

          expect(
            response.status,
          ).toBe(
            201,
          );

          expect(
            response.body,
          ).toMatchObject({
            notificationId:
              fixture.notificationId,

            accepted:
              true,

            action:
              'replay-scheduled',
          });

          const body =
            response.body as {
              readonly replayId:
                string;

              readonly outboxEventId:
                string;

              readonly idempotencyKey:
                string;

              readonly deliveryKey:
                string;

              readonly status:
                string;
            };

          expect(
            body.replayId,
          ).toBeTruthy();

          expect(
            body.outboxEventId,
          ).toBeTruthy();

          expect(
            body.idempotencyKey,
          ).toMatch(
            new RegExp(
              `^notification-replay:${fixture.notificationId}:`,
            ),
          );

          expect(
            body.deliveryKey,
          ).toBeTruthy();

          expect(
            body.status,
          ).toBe(
            'PENDING',
          );

          const notification =
            await prisma.notification.findUnique({
              where: {
                id:
                  fixture.notificationDatabaseId,
              },
            });

          expect(
            notification,
          ).not.toBeNull();

          expect(
            notification?.notificationId,
          ).toBe(
            fixture.notificationId,
          );

          expect(
            notification?.idempotencyKey,
          ).toBe(
            fixture.idempotencyKey,
          );

          expect(
            notification?.status,
          ).toBe(
            'SENT',
          );

          const outbox =
            await prisma.outboxEvent.findUnique({
              where: {
                id:
                  body.outboxEventId,
              },
            });

          expect(
            outbox,
          ).not.toBeNull();

          expect(
            outbox?.payload,
          ).toMatchObject({
            notificationId:
              fixture.notificationId,

            idempotencyKey:
              body.idempotencyKey,

            deliveryKey:
              body.deliveryKey,
          });
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'POST retry returns 404 for an unknown notification',
      async () => {
        const response =
          await post(
            `/internal/notifications/${encodeURIComponent(
              `${suitePrefix}-missing`,
            )}/retry`,
          );

        expect(
          response.status,
        ).toBe(
          404,
        );

        expect(
          response.body,
        ).toMatchObject({
          statusCode:
            404,
        });
      },
    );

    it(
      'POST replay returns 404 for an unknown notification',
      async () => {
        const response =
          await post(
            `/internal/notifications/${encodeURIComponent(
              `${suitePrefix}-missing`,
            )}/replay`,
          );

        expect(
          response.status,
        ).toBe(
          404,
        );

        expect(
          response.body,
        ).toMatchObject({
          statusCode:
            404,
        });
      },
    );

    it(
      'POST retry returns 400 for a SENT notification',
      async () => {
        const fixture =
          await createFixture(
            'SENT',
          );

        try {
          const response =
            await post(
              `/internal/notifications/${encodeURIComponent(
                fixture.notificationId,
              )}/retry`,
            );

          expect(
            response.status,
          ).toBe(
            400,
          );

          expect(
            response.body,
          ).toMatchObject({
            statusCode:
              400,
          });

          const events =
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId:
                  fixture.notificationDatabaseId,

                eventType:
                  'notification.enqueue',
              },
            });

          expect(
            events,
          ).toHaveLength(
            0,
          );
        } finally {
          await cleanupFixture(
            fixture,
          );
        }
      },
    );

    it(
      'POST replay returns 400 for a PROCESSING notification',
      async () => {
        const fixtureId =
          randomUUID();

        const notificationId =
          `${suitePrefix}-${fixtureId}-processing`;

        const userId =
          `${suitePrefix}-${fixtureId}-user`;

        const idempotencyKey =
          `${suitePrefix}-${fixtureId}-idempotency`;

        const notification =
          await prisma.notification.create({
            data: {
              notificationId,

              userId,

              channel:
                'EMAIL',

              status:
                'PROCESSING',

              subject:
                'Processing replay rejection',

              title:
                'Processing',

              body:
                'Processing notification.',

              template:
                null,

              idempotencyKey,

              attempts:
                1,

              queuedAt:
                new Date(),

              processingAt:
                new Date(),
            },
          });

        try {
          const response =
            await post(
              `/internal/notifications/${encodeURIComponent(
                notificationId,
              )}/replay`,
            );

          expect(
            response.status,
          ).toBe(
            400,
          );

          expect(
            response.body,
          ).toMatchObject({
            statusCode:
              400,
          });

          const events =
            await prisma.outboxEvent.findMany({
              where: {
                aggregateId:
                  notification.id,

                eventType:
                  'notification.enqueue',
              },
            });

          expect(
            events,
          ).toHaveLength(
            0,
          );
        } finally {
          await prisma.outboxEvent.deleteMany({
            where: {
              aggregateId:
                notification.id,
            },
          });

          await prisma.notificationDelivery.deleteMany({
            where: {
              notificationId,
            },
          });

          await prisma.notification.deleteMany({
            where: {
              id:
                notification.id,
            },
          });
        }
      },
    );
  },
);