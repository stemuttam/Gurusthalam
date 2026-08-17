import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

export interface OutboxRecord {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly dedupeKey: string;
  readonly payload: unknown;
  readonly status: string;
  readonly attempts: number;
  readonly availableAt: Date;
  readonly lockedAt: Date | null;
  readonly lockedBy: string | null;
  readonly publishedAt: Date | null;
  readonly deadLetteredAt: Date | null;
  readonly recoveredAt: Date | null;
  readonly recoveryCount: number;
  readonly lastAttemptAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OutboxSummary {
  readonly pending: number;
  readonly processing: number;
  readonly published: number;
  readonly failed: number;
  readonly deadLetter: number;
  readonly total: number;
}

export interface StuckRecoveryResult {
  readonly recovered: number;
}

@Injectable()
export class OutboxAdminService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getSummary(): Promise<OutboxSummary> {
    const [
      pending,
      processing,
      published,
      failed,
      deadLetter,
    ] = await Promise.all([
      this.prisma.outboxEvent.count({
        where: {
          status: 'PENDING',
        },
      }),

      this.prisma.outboxEvent.count({
        where: {
          status: 'PROCESSING',
        },
      }),

      this.prisma.outboxEvent.count({
        where: {
          status: 'PUBLISHED',
        },
      }),

      this.prisma.outboxEvent.count({
        where: {
          status: 'FAILED',
        },
      }),

      this.prisma.outboxEvent.count({
        where: {
          status: 'DEAD_LETTER',
        },
      }),
    ]);

    return {
      pending,
      processing,
      published,
      failed,
      deadLetter,
      total:
        pending +
        processing +
        published +
        failed +
        deadLetter,
    };
  }

  async getDeadLetters(
    limit = 50,
  ): Promise<OutboxRecord[]> {
    const events =
      await this.prisma.outboxEvent.findMany({
        where: {
          status:
            'DEAD_LETTER',
        },

        orderBy: {
          deadLetteredAt:
            'desc',
        },

        take: Math.min(
          Math.max(
            limit,
            1,
          ),
          200,
        ),
      });

    return events.map(
      (event): OutboxRecord => ({
        id:
          event.id,

        eventType:
          event.eventType,

        aggregateType:
          event.aggregateType,

        aggregateId:
          event.aggregateId,

        dedupeKey:
          event.dedupeKey,

        payload:
          event.payload,

        status:
          String(event.status),

        attempts:
          event.attempts,

        availableAt:
          event.availableAt,

        lockedAt:
          event.lockedAt,

        lockedBy:
          event.lockedBy,

        publishedAt:
          event.publishedAt,

        deadLetteredAt:
          event.deadLetteredAt,

        recoveredAt:
          event.recoveredAt,

        recoveryCount:
          event.recoveryCount,

        lastAttemptAt:
          event.lastAttemptAt,

        lastError:
          event.lastError,

        createdAt:
          event.createdAt,

        updatedAt:
          event.updatedAt,
      }),
    );
  }

  async getEvent(
    id: string,
  ): Promise<OutboxRecord> {
    const event =
      await this.prisma.outboxEvent.findUnique({
        where: {
          id,
        },
      });

    if (!event) {
      throw new NotFoundException(
        `Outbox event ${id} was not found.`,
      );
    }

    return this.toOutboxRecord(
      event,
    );
  }

  async requeueDeadLetter(
    id: string,
  ): Promise<OutboxRecord> {
    /*
     * First confirm that the event exists.
     */
    const existing =
      await this.prisma.outboxEvent.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        `Outbox event ${id} was not found.`,
      );
    }

    /*
     * Only DEAD_LETTER events may be manually recovered.
     */
    if (
      existing.status !==
      'DEAD_LETTER'
    ) {
      /*
       * A dispatcher may have already recovered/published the
       * event between the first read and this request.
       *
       * Returning the current state makes the endpoint
       * idempotent and race-safe.
       */
      return this.getEvent(id);
    }

    const now =
      new Date();

    const result =
      await this.prisma.outboxEvent.updateMany({
        where: {
          id,

          status:
            'DEAD_LETTER',
        },

        data: {
          status:
            'PENDING',

          availableAt:
            now,

          lockedAt:
            null,

          lockedBy:
            null,

          deadLetteredAt:
            null,

          recoveredAt:
            now,

          recoveryCount: {
            increment: 1,
          },

          lastError:
            null,
        },
      });

    /*
     * The dispatcher may have claimed the row immediately
     * after our update.
     *
     * Therefore, count = 0 does NOT necessarily mean failure.
     * Read the current state and return it when the event still
     * exists.
     */
    if (
      result.count ===
      0
    ) {
      return this.getEvent(id);
    }

    /*
     * The dispatcher can race us immediately after this
     * successful update. So simply return the current state.
     *
     * It may be:
     *   PENDING
     *   PROCESSING
     *   PUBLISHED
     */
    return this.getEvent(id);
  }

  async recoverStuckEvents(): Promise<StuckRecoveryResult> {
    const cutoff =
      new Date(
        Date.now() -
          60_000,
      );

    const result =
      await this.prisma.outboxEvent.updateMany({
        where: {
          status:
            'PROCESSING',

          lockedAt: {
            lt:
              cutoff,
          },
        },

        data: {
          status:
            'PENDING',

          lockedAt:
            null,

          lockedBy:
            null,

          availableAt:
            new Date(),

          lastError:
            'Recovered from stale PROCESSING lock.',
        },
      });

    return {
      recovered:
        result.count,
    };
  }

  private toOutboxRecord(
    event: {
      readonly id: string;
      readonly eventType: string;
      readonly aggregateType: string;
      readonly aggregateId: string;
      readonly dedupeKey: string;
      readonly payload: unknown;
      readonly status: unknown;
      readonly attempts: number;
      readonly availableAt: Date;
      readonly lockedAt: Date | null;
      readonly lockedBy: string | null;
      readonly publishedAt: Date | null;
      readonly deadLetteredAt: Date | null;
      readonly recoveredAt: Date | null;
      readonly recoveryCount: number;
      readonly lastAttemptAt: Date | null;
      readonly lastError: string | null;
      readonly createdAt: Date;
      readonly updatedAt: Date;
    },
  ): OutboxRecord {
    return {
      id:
        event.id,

      eventType:
        event.eventType,

      aggregateType:
        event.aggregateType,

      aggregateId:
        event.aggregateId,

      dedupeKey:
        event.dedupeKey,

      payload:
        event.payload,

      status:
        String(event.status),

      attempts:
        event.attempts,

      availableAt:
        event.availableAt,

      lockedAt:
        event.lockedAt,

      lockedBy:
        event.lockedBy,

      publishedAt:
        event.publishedAt,

      deadLetteredAt:
        event.deadLetteredAt,

      recoveredAt:
        event.recoveredAt,

      recoveryCount:
        event.recoveryCount,

      lastAttemptAt:
        event.lastAttemptAt,

      lastError:
        event.lastError,

      createdAt:
        event.createdAt,

      updatedAt:
        event.updatedAt,
    };
  }
}