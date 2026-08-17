import {
  randomUUID,
} from 'node:crypto';

import {
  Queue,
} from 'bullmq';

import {
  PrismaClient,
} from '@gurusthalam/database';

import {
  getRedisConfig,
} from '@gurusthalam/config';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

import type {
  NotificationJobData,
  NotificationJsonValue,
} from '../processors/notification.processor.js';

import {
  OUTBOX_BATCH_SIZE,
  OUTBOX_LOCK_TIMEOUT_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_POLL_INTERVAL_MS,
  OUTBOX_QUEUE_NAME,
  OUTBOX_QUEUE_PREFIX,
} from './outbox.constants.js';

interface OutboxRow {
  readonly id: string;
  readonly payload: unknown;
  readonly attempts: number;
}

export class OutboxDispatcher {
  private readonly instanceId =
    `outbox-${randomUUID()}`;

  private readonly queue: Queue;

  private timer:
    NodeJS.Timeout | undefined;

  private running = false;

  private polling = false;

  constructor(
    private readonly prisma:
      PrismaClient,

    private readonly logger:
      GurusthalamLogger,
  ) {
    const redis =
      getRedisConfig();

    this.queue =
      new Queue(
        OUTBOX_QUEUE_NAME,
        {
          connection: {
            url:
              redis.url,
          },

          prefix:
            OUTBOX_QUEUE_PREFIX,
        },
      );
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    void this.poll();

    this.timer =
      setInterval(
        () => {
          void this.poll();
        },
        OUTBOX_POLL_INTERVAL_MS,
      );

    this.logger.info(
      'Outbox dispatcher started',
      {
        operation:
          'outbox.start',
        service:
          'outbox',
      },
    );
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(
        this.timer,
      );

      this.timer =
        undefined;
    }

    /*
     * Wait for any in-flight polling cycle to finish
     * before closing the BullMQ queue.
     */
    while (this.polling) {
      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            50,
          );
        },
      );
    }

    await this.queue.close();

    this.logger.info(
      'Outbox dispatcher stopped',
      {
        operation:
          'outbox.stop',
        service:
          'outbox',
      },
    );
  }

  private async poll(): Promise<void> {
    /*
     * Prevent overlapping polling cycles inside the same
     * dispatcher instance.
     */
    if (
      !this.running ||
      this.polling
    ) {
      return;
    }

    this.polling = true;

    try {
      await this.releaseExpiredLocks();

      const events =
        await this.claimPendingEvents();

      for (
        const event of events
      ) {
        if (!this.running) {
          break;
        }

        await this.publish(
          event,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'Outbox dispatcher poll failed',
        error,
        {
          operation:
            'outbox.poll.error',
          service:
            'outbox',
        },
      );
    } finally {
      this.polling = false;
    }
  }

  private async claimPendingEvents(): Promise<
    OutboxRow[]
  > {
    const lockDate =
      new Date();

    /*
     * The CTE selects available events with row-level
     * locking and SKIP LOCKED. The update then transfers
     * ownership to this dispatcher instance atomically.
     */
    return this.prisma.$queryRaw<
      OutboxRow[]
    >`
      WITH candidates AS (
        SELECT id
        FROM "OutboxEvent"
        WHERE
          (
            status =
              'PENDING'::"OutboxStatus"

            OR (
              status =
                'PROCESSING'::"OutboxStatus"

              AND "lockedAt" <
                NOW() -
                (
                  ${OUTBOX_LOCK_TIMEOUT_MS}
                  * INTERVAL '1 millisecond'
                )
            )
          )

          AND "availableAt" <= NOW()

        ORDER BY
          "createdAt" ASC

        FOR UPDATE SKIP LOCKED

        LIMIT
          ${OUTBOX_BATCH_SIZE}
      )

      UPDATE "OutboxEvent" AS outbox

      SET
        status =
          'PROCESSING'::"OutboxStatus",

        "lockedAt" =
          ${lockDate},

        "lockedBy" =
          ${this.instanceId},

        attempts =
          outbox.attempts + 1,

        "lastAttemptAt" =
          NOW(),

        "updatedAt" =
          NOW()

      FROM candidates

      WHERE
        outbox.id =
          candidates.id

      RETURNING
        outbox.id,
        outbox.payload,
        outbox.attempts
    `;
  }

  private async publish(
    event: OutboxRow,
  ): Promise<void> {
    /*
     * Verify that this dispatcher still owns the event.
     */
    const current =
      await this.prisma.outboxEvent.findUnique({
        where: {
          id:
            event.id,
        },

        select: {
          status: true,
          lockedBy: true,
          attempts: true,
        },
      });

    if (!current) {
      return;
    }

    if (
      current.status ===
      'PUBLISHED'
    ) {
      this.logger.info(
        `Outbox event already published: ${event.id}`,
        {
          operation:
            'outbox.ownership.skip',
          service:
            'outbox',
        },
      );

      return;
    }

    if (
      current.status ===
      'DEAD_LETTER'
    ) {
      this.logger.info(
        `Outbox event is dead-lettered: ${event.id}`,
        {
          operation:
            'outbox.ownership.skip',
          service:
            'outbox',
        },
      );

      return;
    }

    if (
      current.lockedBy !==
      this.instanceId
    ) {
      this.logger.info(
        `Outbox event ownership changed: ${event.id}`,
        {
          operation:
            'outbox.ownership.skip',
          service:
            'outbox',
        },
      );

      return;
    }

    try {
      const data =
        this.parseNotificationData(
          event.payload,
        );

      /*
       * Deterministic BullMQ job ID provides logical
       * idempotency if publication is retried.
       */
      await this.queue.add(
        `notification:${data.channel}`,
        data,
        {
          jobId:
            data.idempotencyKey,

          attempts:
            3,

          backoff: {
            type:
              'exponential',
            delay:
              1000,
          },

          removeOnComplete:
            100,

          removeOnFail:
            1000,
        },
      );

      /*
       * Only the dispatcher that currently owns the event
       * can transition PROCESSING -> PUBLISHED.
       */
      const updated =
        await this.prisma.outboxEvent.updateMany({
          where: {
            id:
              event.id,

            status:
              'PROCESSING',

            lockedBy:
              this.instanceId,
          },

          data: {
            status:
              'PUBLISHED',

            publishedAt:
              new Date(),

            lockedAt:
              null,

            lockedBy:
              null,

            lastError:
              null,
          },
        });

      if (
        updated.count ===
        0
      ) {
        /*
         * The BullMQ job was published, but another
         * process owns or changed the outbox record.
         *
         * The deterministic BullMQ jobId protects the
         * logical notification from duplicate jobs.
         */
        this.logger.info(
          `Outbox event publication race: ${event.id}`,
          {
            operation:
              'outbox.publish.race',
            service:
              'outbox',
          },
        );

        return;
      }

      this.logger.info(
        `Outbox event published: ${event.id}`,
        {
          operation:
            'outbox.published',
          service:
            'outbox',
        },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      /*
       * Never overwrite a newer owner/state.
       */
      const ownership =
        await this.prisma.outboxEvent.findUnique({
          where: {
            id:
              event.id,
          },

          select: {
            status: true,
            lockedBy: true,
          },
        });

      if (
        ownership &&
        ownership.status !==
          'PROCESSING'
      ) {
        this.logger.info(
          `Outbox event state changed during failure handling: ${event.id}`,
          {
            operation:
              'outbox.ownership.skip',
            service:
              'outbox',
          },
        );

        return;
      }

      if (
        ownership &&
        ownership.lockedBy !==
          this.instanceId
      ) {
        this.logger.info(
          `Outbox event ownership changed during failure handling: ${event.id}`,
          {
            operation:
              'outbox.ownership.skip',
            service:
              'outbox',
          },
        );

        return;
      }

      const deadLetter =
        event.attempts >=
        OUTBOX_MAX_ATTEMPTS;

      const updated =
        await this.prisma.outboxEvent.updateMany({
          where: {
            id:
              event.id,

            status:
              'PROCESSING',

            lockedBy:
              this.instanceId,
          },

          data: {
            status:
              deadLetter
                ? 'DEAD_LETTER'
                : 'PENDING',

            availableAt:
              deadLetter
                ? new Date()
                : new Date(
                    Date.now() +
                      this.getBackoffMs(
                        event.attempts,
                      ),
                  ),

            lockedAt:
              null,

            lockedBy:
              null,

            deadLetteredAt:
              deadLetter
                ? new Date()
                : null,

            lastAttemptAt:
              new Date(),

            lastError:
              message,
          },
        });

      if (
        updated.count ===
        0
      ) {
        this.logger.info(
          `Outbox event failure state update lost ownership: ${event.id}`,
          {
            operation:
              'outbox.ownership.skip',
            service:
              'outbox',
          },
        );

        return;
      }

      if (deadLetter) {
        this.logger.error(
          `Outbox event dead-lettered: ${event.id}`,
          error,
          {
            operation:
              'outbox.dead_lettered',
            service:
              'outbox',
          },
        );
      } else {
        this.logger.error(
          `Outbox event retrying: ${event.id}`,
          error,
          {
            operation:
              'outbox.retrying',
            service:
              'outbox',
          },
        );
      }
    }
  }

  private async releaseExpiredLocks(): Promise<void> {
    /*
     * Stale PROCESSING rows are returned to PENDING.
     *
     * We do not touch PUBLISHED or DEAD_LETTER rows.
     */
    await this.prisma.$executeRaw`
      UPDATE "OutboxEvent"

      SET
        status =
          'PENDING'::"OutboxStatus",

        "lockedAt" =
          NULL,

        "lockedBy" =
          NULL,

        "updatedAt" =
          NOW(),

        "lastError" =
          COALESCE(
            "lastError",
            'Recovered from stale PROCESSING lock.'
          )

      WHERE
        status =
          'PROCESSING'::"OutboxStatus"

        AND "lockedAt" <
          NOW() -
          (
            ${OUTBOX_LOCK_TIMEOUT_MS}
            * INTERVAL '1 millisecond'
          )
    `;
  }

  private parseNotificationData(
    payload: unknown,
  ): NotificationJobData {
    if (
      !this.isRecord(payload)
    ) {
      throw new Error(
        'Invalid notification outbox payload.',
      );
    }

    const notificationId =
      this.requireString(
        payload,
        'notificationId',
      );

    const channel =
      this.parseChannel(
        payload.channel,
      );

    const idempotencyKey =
      this.requireString(
        payload,
        'idempotencyKey',
      );

    const body =
      this.requireString(
        payload,
        'body',
      );

    const recipient =
      this.parseRecipient(
        payload.recipient,
      );

    const subject =
      payload.subject !==
      undefined
        ? this.requireStringValue(
            payload.subject,
            'subject',
          )
        : undefined;

    const title =
      payload.title !==
      undefined
        ? this.requireStringValue(
            payload.title,
            'title',
          )
        : undefined;

    const template =
      payload.template !==
      undefined
        ? this.requireStringValue(
            payload.template,
            'template',
          )
        : undefined;

    const templateData =
      payload.templateData !==
      undefined
        ? this.parseTemplateData(
            payload.templateData,
          )
        : undefined;

    return {
      notificationId,
      channel,
      recipient,
      body,
      idempotencyKey,

      ...(subject !==
      undefined
        ? {
            subject,
          }
        : {}),

      ...(title !==
      undefined
        ? {
            title,
          }
        : {}),

      ...(template !==
      undefined
        ? {
            template,
          }
        : {}),

      ...(templateData !==
      undefined
        ? {
            templateData,
          }
        : {}),
    };
  }

  private parseChannel(
    value: unknown,
  ): NotificationJobData['channel'] {
    if (
      value ===
        'email' ||
      value ===
        'in-app' ||
      value ===
        'push'
    ) {
      return value;
    }

    throw new Error(
      'Outbox payload channel is invalid.',
    );
  }

  private parseRecipient(
    value: unknown,
  ): NotificationJobData['recipient'] {
    if (
      !this.isRecord(value)
    ) {
      throw new Error(
        'Outbox payload recipient is invalid.',
      );
    }

    const userId =
      this.requireString(
        value,
        'userId',
      );

    const email =
      value.email !==
      undefined
        ? this.requireStringValue(
            value.email,
            'recipient.email',
          )
        : undefined;

    const deviceTokens =
      value.deviceTokens !==
      undefined
        ? this.parseDeviceTokens(
            value.deviceTokens,
          )
        : undefined;

    return {
      userId,

      ...(email !==
      undefined
        ? {
            email,
          }
        : {}),

      ...(deviceTokens !==
      undefined
        ? {
            deviceTokens,
          }
        : {}),
    };
  }

  private parseDeviceTokens(
    value: unknown,
  ): string[] {
    if (
      !Array.isArray(value)
    ) {
      throw new Error(
        'Outbox payload recipient.deviceTokens is invalid.',
      );
    }

    return value.map(
      (token) =>
        this.requireStringValue(
          token,
          'recipient.deviceTokens',
        ),
    );
  }

  private parseTemplateData(
    value: unknown,
  ): {
    [key: string]: NotificationJsonValue;
  } {
    if (
      !this.isJsonObject(value)
    ) {
      throw new Error(
        'Outbox payload templateData is invalid.',
      );
    }

    return value;
  }

  private requireString(
    value: Record<
      string,
      unknown
    >,
    key: string,
  ): string {
    return this.requireStringValue(
      value[key],
      key,
    );
  }

  private requireStringValue(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !==
        'string' ||
      value.trim().length ===
        0
    ) {
      throw new Error(
        `Outbox payload ${field} is invalid.`,
      );
    }

    return value;
  }

  private isRecord(
    value: unknown,
  ): value is Record<
    string,
    unknown
  > {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(
        value,
      )
    );
  }

  private isJsonPrimitive(
    value: unknown,
  ): value is
    | string
    | number
    | boolean
    | null {
    return (
      value === null ||
      typeof value ===
        'string' ||
      typeof value ===
        'number' ||
      typeof value ===
        'boolean'
    );
  }

  private isJsonValue(
    value: unknown,
  ): value is NotificationJsonValue {
    if (
      this.isJsonPrimitive(
        value,
      )
    ) {
      return true;
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value.every(
        (item) =>
          this.isJsonValue(
            item,
          ),
      );
    }

    if (
      this.isRecord(
        value,
      )
    ) {
      return Object.values(
        value,
      ).every(
        (item) =>
          this.isJsonValue(
            item,
          ),
      );
    }

    return false;
  }

  private isJsonObject(
    value: unknown,
  ): value is {
    [key: string]: NotificationJsonValue;
  } {
    return (
      this.isRecord(
        value,
      ) &&
      Object.values(
        value,
      ).every(
        (item) =>
          this.isJsonValue(
            item,
          ),
      )
    );
  }

  private getBackoffMs(
    attempts: number,
  ): number {
    return Math.min(
      60_000,
      1000 *
        Math.pow(
          2,
          Math.max(
            0,
            attempts - 1,
          ),
        ),
    );
  }
}