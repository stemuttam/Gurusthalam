import { Injectable } from '@nestjs/common';

import type {
  LearningHistoryQueryRepository,
  ListLearningHistoryInput,
  ListLearningHistoryResult,
  ListQualifyingLearningActivityDaysInput,
} from '@gurusthalam/learning';

import { Prisma } from '@gurusthalam/database';

import { PrismaService } from '../../prisma.service.js';
import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

interface HistoryRow {
  readonly eventId: string;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly occurredAt: Date;
  readonly sessionId: string | null;
  readonly durationMs: number | null;
  readonly completionPercent: number | null;
  readonly score: number | null;
}

interface ActivityDayRow {
  readonly activityDay: string;
}

@Injectable()
export class PrismaLearningHistoryQueryRepository implements LearningHistoryQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listHistory(
    input: ListLearningHistoryInput,
  ): Promise<ListLearningHistoryResult> {
    return withPrismaRepositoryErrorBoundary(
      'LearningHistoryQueryRepository.listHistory',
      async () => {
        const tenantFilter =
          input.tenantId === undefined
            ? Prisma.empty
            : Prisma.sql`AND "tenantId" = ${input.tenantId}`;

        const fromFilter =
          input.from === undefined
            ? Prisma.empty
            : Prisma.sql`AND "occurredAt" >= ${input.from}`;

        const toFilter =
          input.to === undefined
            ? Prisma.empty
            : Prisma.sql`AND "occurredAt" <= ${input.to}`;

        const cursorFilter =
          input.cursor === undefined
            ? Prisma.empty
            : Prisma.sql`
                AND ("occurredAt", "eventId") <
                    (${input.cursor.occurredAt}, ${input.cursor.eventId})
              `;

        const rows = await this.prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
          SELECT
            "eventId",
            "eventType",
            "entityType",
            "entityId",
            "occurredAt",
            "sessionId",
            CASE
              WHEN "metrics" ->> 'durationMs' IS NULL THEN NULL
              ELSE ("metrics" ->> 'durationMs')::double precision
            END AS "durationMs",
            CASE
              WHEN "metrics" ->> 'completionPercent' IS NULL THEN NULL
              ELSE ("metrics" ->> 'completionPercent')::double precision
            END AS "completionPercent",
            CASE
              WHEN "metrics" ->> 'score' IS NULL THEN NULL
              ELSE ("metrics" ->> 'score')::double precision
            END AS "score"
          FROM "LearningActivityEvent"
          WHERE "learnerId" = ${input.learnerId}
            ${tenantFilter}
            ${fromFilter}
            ${toFilter}
            ${cursorFilter}
          ORDER BY "occurredAt" DESC, "eventId" DESC
          LIMIT ${input.limit + 1}
        `);

        const hasMore = rows.length > input.limit;
        const pageRows = hasMore ? rows.slice(0, input.limit) : rows;

        const items = pageRows.map((row) => ({
          eventId: row.eventId,
          eventType: row.eventType,
          entityType: row.entityType,
          entityId: row.entityId,
          occurredAt: row.occurredAt,
          sessionId: row.sessionId,
          durationMs: row.durationMs,
          completionPercent: row.completionPercent,
          score: row.score,
        }));

        const lastItem = items[items.length - 1];

        return {
          items,
          nextCursor:
            hasMore && lastItem !== undefined
              ? {
                  occurredAt: lastItem.occurredAt,
                  eventId: lastItem.eventId,
                }
              : null,
        };
      },
    );
  }

  async listQualifyingActivityDays(
    input: ListQualifyingLearningActivityDaysInput,
  ): Promise<readonly string[]> {
    if (input.qualifyingEventTypes.length === 0) {
      return [];
    }

    return withPrismaRepositoryErrorBoundary(
      'LearningHistoryQueryRepository.listQualifyingActivityDays',
      async () => {
        const tenantFilter =
          input.tenantId === undefined
            ? Prisma.empty
            : Prisma.sql`AND "tenantId" = ${input.tenantId}`;

        const rows = await this.prisma.$queryRaw<ActivityDayRow[]>(Prisma.sql`
          SELECT DISTINCT
            to_char(
              (
                (
                  "occurredAt" AT TIME ZONE 'UTC'
                ) AT TIME ZONE ${input.timezone}
              )::date,
              'YYYY-MM-DD'
            ) AS "activityDay"
          FROM "LearningActivityEvent"
          WHERE "learnerId" = ${input.learnerId}
            ${tenantFilter}
            AND "eventType" IN (${Prisma.join(input.qualifyingEventTypes)})
            AND "occurredAt" <= ${input.asOf}
          ORDER BY "activityDay" ASC
        `);

        return rows.map((row) => row.activityDay);
      },
    );
  }
}
