import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@gurusthalam/database';

import { GurusthalamLogger } from '@gurusthalam/logger';

import { BullMqCourseOutboxDispatchHandler } from './course-outbox-dispatch.handler.js';

import {
  isCourseOutboxDispatchEvent,
  type CourseOutboxDispatchEvent,
} from './course-outbox-dispatch.contracts.js';

import { NotificationOutboxDispatchHandler } from './notification-outbox-dispatch.handler.js';

import {
  OUTBOX_DISPATCH_ROUTES,
  resolveOutboxDispatchRoute,
} from './outbox-event.router.js';

import {
  OUTBOX_BATCH_SIZE,
  OUTBOX_LOCK_TIMEOUT_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_POLL_INTERVAL_MS,
} from './outbox.constants.js';

interface OutboxRow {
  readonly id: string;

  readonly eventType: string;

  readonly aggregateType: string;

  readonly aggregateId: string;

  readonly dedupeKey: string;

  readonly payload: unknown;

  readonly attempts: number;
}

export class OutboxDispatcher {
  private readonly instanceId = `outbox-${randomUUID()}`;

  private readonly notificationDispatchHandler: NotificationOutboxDispatchHandler;

  private readonly courseDispatchHandler: BullMqCourseOutboxDispatchHandler;

  private timer: NodeJS.Timeout | undefined;

  private running = false;

  private polling = false;

  constructor(
    private readonly prisma: PrismaClient,

    private readonly logger: GurusthalamLogger,
  ) {
    this.notificationDispatchHandler =
      NotificationOutboxDispatchHandler.fromRedisConfig();

    this.courseDispatchHandler =
      BullMqCourseOutboxDispatchHandler.fromRedisConfig();
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    void this.poll();

    this.timer = setInterval(() => {
      void this.poll();
    }, OUTBOX_POLL_INTERVAL_MS);

    this.logger.info('Outbox dispatcher started', {
      operation: 'outbox.start',

      service: 'outbox',
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);

      this.timer = undefined;
    }

    /*
     * Do not close either BullMQ queue while a dispatch cycle is
     * still executing.
     */
    while (this.polling) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }

    await Promise.all([
      this.notificationDispatchHandler.close(),
      this.courseDispatchHandler.close(),
    ]);

    this.logger.info('Outbox dispatcher stopped', {
      operation: 'outbox.stop',

      service: 'outbox',
    });
  }

  private async poll(): Promise<void> {
    if (!this.running || this.polling) {
      return;
    }

    this.polling = true;

    try {
      await this.releaseExpiredLocks();

      const events = await this.claimPendingEvents();

      for (const event of events) {
        if (!this.running) {
          break;
        }

        await this.publish(event);
      }
    } catch (error: unknown) {
      this.logger.error('Outbox dispatcher poll failed', error, {
        operation: 'outbox.poll.error',

        service: 'outbox',
      });
    } finally {
      this.polling = false;
    }
  }

  private async claimPendingEvents(): Promise<OutboxRow[]> {
    const lockDate = new Date();

    /*
     * Claim PENDING events and recover expired PROCESSING events
     * atomically.
     *
     * FOR UPDATE SKIP LOCKED allows multiple dispatcher instances
     * to operate concurrently without claiming the same row.
     */
    return this.prisma.$queryRaw<OutboxRow[]>`
      WITH candidates AS (
        SELECT
          id
        FROM
          "OutboxEvent"
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

      UPDATE
        "OutboxEvent" AS outbox

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

      FROM
        candidates

      WHERE
        outbox.id =
          candidates.id

      RETURNING
        outbox.id,
        outbox."eventType" AS "eventType",
        outbox."aggregateType" AS "aggregateType",
        outbox."aggregateId" AS "aggregateId",
        outbox."dedupeKey" AS "dedupeKey",
        outbox.payload,
        outbox.attempts
    `;
  }

  private async publish(event: OutboxRow): Promise<void> {
    /*
     * Re-check the current database ownership before dispatching.
     */
    const current = await this.prisma.outboxEvent.findUnique({
      where: {
        id: event.id,
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

    if (current.status === 'PUBLISHED') {
      this.logger.info(`Outbox event already published: ${event.id}`, {
        operation: 'outbox.ownership.skip',

        service: 'outbox',
      });

      return;
    }

    if (current.status === 'DEAD_LETTER') {
      this.logger.info(`Outbox event is dead-lettered: ${event.id}`, {
        operation: 'outbox.ownership.skip',

        service: 'outbox',
      });

      return;
    }

    if (current.lockedBy !== this.instanceId) {
      this.logger.info(`Outbox event ownership changed: ${event.id}`, {
        operation: 'outbox.ownership.skip',

        service: 'outbox',
      });

      return;
    }

    try {
      const route = resolveOutboxDispatchRoute({
        aggregateType: event.aggregateType,

        eventType: event.eventType,
      });

      switch (route) {
        case OUTBOX_DISPATCH_ROUTES.NOTIFICATION:
          await this.notificationDispatchHandler.dispatch(event.payload);
          break;

        case OUTBOX_DISPATCH_ROUTES.COURSE: {
          const courseEvent = this.toCourseDispatchEvent(event);

          await this.courseDispatchHandler.dispatch(courseEvent);

          break;
        }

        default:
          throw new Error(
            `Unsupported Outbox dispatch route for event "${event.id}".`,
          );
      }

      /*
       * Only the dispatcher that still owns the PROCESSING row may
       * transition it to PUBLISHED.
       */
      const updated = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,

          status: 'PROCESSING',

          lockedBy: this.instanceId,
        },

        data: {
          status: 'PUBLISHED',

          publishedAt: new Date(),

          lockedAt: null,

          lockedBy: null,

          lastError: null,
        },
      });

      if (updated.count === 0) {
        /*
         * Transport publication succeeded but database ownership was
         * lost before PROCESSING -> PUBLISHED.
         *
         * The route-specific transport handlers use deterministic
         * identities so recovery cannot intentionally manufacture a
         * second logical event.
         */
        this.logger.info(`Outbox event publication race: ${event.id}`, {
          operation: 'outbox.publish.race',

          service: 'outbox',
        });

        return;
      }

      this.logger.info(`Outbox event published: ${event.id}`, {
        operation: 'outbox.published',

        service: 'outbox',
      });
    } catch (error: unknown) {
      await this.handlePublishFailure(event, error);
    }
  }

  private async handlePublishFailure(
    event: OutboxRow,

    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    /*
     * Re-check ownership before modifying retry state.
     */
    const ownership = await this.prisma.outboxEvent.findUnique({
      where: {
        id: event.id,
      },

      select: {
        status: true,

        lockedBy: true,
      },
    });

    if (!ownership) {
      return;
    }

    if (ownership.status !== 'PROCESSING') {
      this.logger.info(
        `Outbox event state changed during failure handling: ${event.id}`,
        {
          operation: 'outbox.ownership.skip',

          service: 'outbox',
        },
      );

      return;
    }

    if (ownership.lockedBy !== this.instanceId) {
      this.logger.info(
        `Outbox event ownership changed during failure handling: ${event.id}`,
        {
          operation: 'outbox.ownership.skip',

          service: 'outbox',
        },
      );

      return;
    }

    const deadLetter = event.attempts >= OUTBOX_MAX_ATTEMPTS;

    const now = new Date();

    const updated = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,

        status: 'PROCESSING',

        lockedBy: this.instanceId,
      },

      data: {
        status: deadLetter ? 'DEAD_LETTER' : 'PENDING',

        availableAt: deadLetter
          ? now
          : new Date(now.getTime() + this.getBackoffMs(event.attempts)),

        lockedAt: null,

        lockedBy: null,

        deadLetteredAt: deadLetter ? now : null,

        lastAttemptAt: now,

        lastError: message,
      },
    });

    if (updated.count === 0) {
      this.logger.info(
        `Outbox event failure update lost ownership: ${event.id}`,
        {
          operation: 'outbox.ownership.skip',

          service: 'outbox',
        },
      );

      return;
    }

    if (deadLetter) {
      this.logger.error(`Outbox event dead-lettered: ${event.id}`, error, {
        operation: 'outbox.dead_lettered',

        service: 'outbox',
      });

      return;
    }

    this.logger.error(`Outbox event retrying: ${event.id}`, error, {
      operation: 'outbox.retrying',

      service: 'outbox',
    });
  }

  private toCourseDispatchEvent(event: OutboxRow): CourseOutboxDispatchEvent {
    const candidate: unknown = {
      id: event.id,

      eventType: event.eventType,

      aggregateType: event.aggregateType,

      aggregateId: event.aggregateId,

      dedupeKey: event.dedupeKey,

      payload: event.payload,

      attempts: event.attempts,
    };

    if (!isCourseOutboxDispatchEvent(candidate)) {
      throw new Error(
        `Invalid Course Outbox dispatch envelope for Outbox event "${event.id}".`,
      );
    }

    return candidate;
  }

  private async releaseExpiredLocks(): Promise<void> {
    /*
     * Recover stale PROCESSING records.
     *
     * PUBLISHED and DEAD_LETTER rows are intentionally untouched.
     */
    await this.prisma.$executeRaw`
      UPDATE
        "OutboxEvent"

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

  private getBackoffMs(attempts: number): number {
    return Math.min(
      60_000,

      1000 * Math.pow(2, Math.max(0, attempts - 1)),
    );
  }
}
