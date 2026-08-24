import {
  createPrismaClient,
  type PrismaClient,
} from '@gurusthalam/database';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

const DEFAULT_POLL_INTERVAL_MS =
  5_000;

const DEFAULT_BATCH_SIZE =
  100;

type JsonRecord = {
  readonly [key: string]:
    unknown;
};

export interface DeadLetterSyncResult {
  readonly scanned:
    number;

  readonly synchronized:
    number;

  readonly replayEventsSkipped:
    number;

  readonly invalidEvents:
    number;
}

export class OutboxDeadLetterSyncService {
  private readonly prisma:
    PrismaClient;

  private readonly intervalMs:
    number;

  private readonly batchSize:
    number;

  private timer:
    NodeJS.Timeout | undefined;

  private running =
    false;

  private synchronizing =
    false;

  constructor(
    private readonly logger:
      GurusthalamLogger,

    prisma?:
      PrismaClient,

    intervalMs =
      DEFAULT_POLL_INTERVAL_MS,

    batchSize =
      DEFAULT_BATCH_SIZE,
  ) {
    this.prisma =
      prisma ??
      createPrismaClient();

    this.intervalMs =
      Math.max(
        1_000,
        Math.floor(
          intervalMs,
        ),
      );

    this.batchSize =
      Math.min(
        Math.max(
          1,
          Math.floor(
            batchSize,
          ),
        ),
        1_000,
      );
  }

  async start(): Promise<void> {
    if (
      this.running
    ) {
      return;
    }

    await this.prisma.$connect();

    this.running =
      true;

    void this.synchronize();

    this.timer =
      setInterval(
        () => {
          void this.synchronize();
        },
        this.intervalMs,
      );

    this.logger.info(
      'Outbox dead-letter synchronization started',
      {
        operation:
          'outbox.dead_letter_sync.start',

        service:
          'outbox',
      },
    );
  }

  async stop(): Promise<void> {
    if (
      !this.running
    ) {
      /*
       * A test or one-shot caller may have injected a Prisma
       * client and never called start(). Do not force a disconnect
       * here because the injected client belongs to the caller.
       */
      return;
    }

    this.running =
      false;

    if (
      this.timer
    ) {
      clearInterval(
        this.timer,
      );

      this.timer =
        undefined;
    }

    while (
      this.synchronizing
    ) {
      await new Promise<void>(
        (
          resolve,
        ) => {
          setTimeout(
            resolve,
            25,
          );
        },
      );
    }

    await this.prisma.$disconnect();

    this.logger.info(
      'Outbox dead-letter synchronization stopped',
      {
        operation:
          'outbox.dead_letter_sync.stop',

        service:
          'outbox',
      },
    );
  }

  async synchronize(): Promise<DeadLetterSyncResult> {
    /*
     * `synchronize()` is intentionally a one-shot operation.
     *
     * It must work both:
     *
     *   1. from the recurring background loop started by start()
     *   2. directly from unit/integration tests or an operator
     *
     * Therefore it MUST NOT require this.running === true.
     *
     * The synchronizing flag remains the protection against
     * overlapping passes inside this service instance.
     */
    if (
      this.synchronizing
    ) {
      return {
        scanned:
          0,

        synchronized:
          0,

        replayEventsSkipped:
          0,

        invalidEvents:
          0,
      };
    }

    this.synchronizing =
      true;

    try {
      return await this.synchronizeInternal();
    } catch (
      error: unknown
    ) {
      this.logger.error(
        'Outbox dead-letter synchronization failed',
        error,
        {
          operation:
            'outbox.dead_letter_sync.error',

          service:
            'outbox',
        },
      );

      throw error;
    } finally {
      this.synchronizing =
        false;
    }
  }

  private async synchronizeInternal(): Promise<DeadLetterSyncResult> {
    const events =
      await this.prisma.outboxEvent.findMany({
        where: {
          eventType:
            'notification.enqueue',

          aggregateType:
            'Notification',

          status:
            'DEAD_LETTER',
        },

        select: {
          id:
            true,

          aggregateId:
            true,

          payload:
            true,

          lastError:
            true,

          deadLetteredAt:
            true,
        },

        orderBy: {
          deadLetteredAt:
            'asc',
        },

        take:
          this.batchSize,
      });

    let synchronized =
      0;

    let replayEventsSkipped =
      0;

    let invalidEvents =
      0;

    /*
     * A one-shot synchronization pass processes the complete
     * snapshot it selected. Do not gate this loop on `running`.
     */
    for (
      const event of events
    ) {
      const payload =
        this.parsePayload(
          event.payload,
        );

      if (
        !payload
      ) {
        invalidEvents +=
          1;

        this.logger.error(
          `Dead-letter notification event has invalid payload: ${event.id}`,
          new Error(
            'Invalid notification outbox payload.',
          ),
          {
            operation:
              'outbox.dead_letter_sync.invalid_payload',

            service:
              'outbox',
          },
        );

        continue;
      }

      const notificationId =
        this.readString(
          payload,
          'notificationId',
        );

      if (
        !notificationId
      ) {
        invalidEvents +=
          1;

        this.logger.error(
          `Dead-letter notification event has no notificationId: ${event.id}`,
          new Error(
            'Notification outbox payload is missing notificationId.',
          ),
          {
            operation:
              'outbox.dead_letter_sync.invalid_payload',

            service:
              'outbox',
          },
        );

        continue;
      }

      /*
       * Replay events carry a unique deliveryKey.
       *
       * A replay is an independent delivery attempt and must never
       * change the parent Notification lifecycle.
       */
      const deliveryKey =
        this.readString(
          payload,
          'deliveryKey',
        );

      if (
        deliveryKey
      ) {
        replayEventsSkipped +=
          1;

        continue;
      }

      const reason =
        this.buildFailureReason(
          event.lastError,
          event.id,
          event.deadLetteredAt,
        );

      /*
       * Only non-terminal notification states can be synchronized
       * to FAILED.
       *
       * SENT and FAILED are already terminal and therefore must be
       * left untouched.
       *
       * updateMany() makes the transition idempotent and avoids a
       * read-then-write race.
       */
      const result =
        await this.prisma.notification.updateMany({
          where: {
            notificationId,

            status: {
              in: [
                'QUEUED',
                'PROCESSING',
                'RETRYING',
              ],
            },
          },

          data: {
            status:
              'FAILED',

            failedAt:
              new Date(),

            failureReason:
              reason,
          },
        });

      if (
        result.count >
        0
      ) {
        synchronized +=
          result.count;

        this.logger.warn(
  `Notification ${notificationId} synchronized to FAILED after outbox dead-letter: ${reason}`,
  {
    operation:
      'outbox.dead_letter_sync.failed',

    service:
      'outbox',
  },
);
      }
    }

    return {
      scanned:
        events.length,

      synchronized,

      replayEventsSkipped,

      invalidEvents,
    };
  }

  private parsePayload(
    payload:
      unknown,
  ):
    JsonRecord | null {
    if (
      typeof payload !==
      'object' ||
      payload ===
        null ||
      Array.isArray(
        payload,
      )
    ) {
      return null;
    }

    return payload as JsonRecord;
  }

  private readString(
    payload:
      JsonRecord,

    key:
      string,
  ):
    string | undefined {
    const value =
      payload[key];

    if (
      typeof value !==
        'string' ||
      value.trim()
        .length ===
        0
    ) {
      return undefined;
    }

    return value;
  }

  private buildFailureReason(
    lastError:
      string | null,

    eventId:
      string,

    deadLetteredAt:
      Date | null,
  ): string {
    const timestamp =
      (
        deadLetteredAt ??
        new Date()
      ).toISOString();

    const detail =
      lastError?.trim();

    if (
      detail
    ) {
      return `Notification delivery permanently failed after outbox dead-letter event ${eventId} at ${timestamp}: ${detail}`;
    }

    return `Notification delivery permanently failed after outbox dead-letter event ${eventId} at ${timestamp}.`;
  }
}