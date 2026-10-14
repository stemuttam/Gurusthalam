import { Injectable } from '@nestjs/common';

import {
  CourseProgressReadModelTimestampConflictError,
  CourseProgressReadModelVersionConflictError,
  type CourseProgressReadModel,
  type CourseProgressReadModelRepository,
  type CourseProgressReadModelSaveResult,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';
import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';
import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

interface LockedEnrollmentRow {
  readonly id: string;
  readonly courseVersionId: string;
}

interface PersistedCourseProgressReadModel {
  readonly enrollmentId: string;
  readonly courseVersionId: string;
  readonly totalLearningUnits: number;
  readonly startedLearningUnits: number;
  readonly completedLearningUnits: number;
  readonly percentage: number;
  readonly hasLearningUnits: boolean;
  readonly calculatedAt: Date;
}

type SaveTransactionResult =
  | {
      readonly kind: 'saved';
      readonly result: CourseProgressReadModelSaveResult;
    }
  | {
      readonly kind: 'conflict';
      readonly error:
        | CourseProgressReadModelTimestampConflictError
        | CourseProgressReadModelVersionConflictError;
    }
  | {
      readonly kind: 'missing-enrollment';
      readonly enrollmentId: string;
    };

/**
 * The first attempt plus three bounded retries.
 *
 * P2034 represents a transaction write conflict or deadlock. The entire
 * transaction must be retried so the next attempt can read the latest
 * committed projection and reevaluate the incoming snapshot.
 */
const MAX_TRANSACTION_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 10;
const MAX_RETRY_DELAY_MS = 100;

function isRetryableTransactionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return error.code === 'P2034';
}

function getRetryDelayMs(failedAttempt: number): number {
  return Math.min(
    INITIAL_RETRY_DELAY_MS * 2 ** (failedAttempt - 1),
    MAX_RETRY_DELAY_MS,
  );
}

async function withSerializableTransactionRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (
        !isRetryableTransactionConflict(error) ||
        attempt >= MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, getRetryDelayMs(attempt));
      });
    }
  }
}

function toDomain(
  row: PersistedCourseProgressReadModel,
): CourseProgressReadModel {
  return {
    enrollmentId: row.enrollmentId,
    courseVersionId: row.courseVersionId,
    totalLearningUnits: row.totalLearningUnits,
    startedLearningUnits: row.startedLearningUnits,
    completedLearningUnits: row.completedLearningUnits,
    percentage: row.percentage,
    hasLearningUnits: row.hasLearningUnits,
    calculatedAt: row.calculatedAt,
  };
}

function sameSnapshot(
  existing: PersistedCourseProgressReadModel,
  incoming: CourseProgressReadModel,
): boolean {
  return (
    existing.enrollmentId === incoming.enrollmentId &&
    existing.courseVersionId === incoming.courseVersionId &&
    existing.totalLearningUnits === incoming.totalLearningUnits &&
    existing.startedLearningUnits === incoming.startedLearningUnits &&
    existing.completedLearningUnits === incoming.completedLearningUnits &&
    existing.percentage === incoming.percentage &&
    existing.hasLearningUnits === incoming.hasLearningUnits &&
    existing.calculatedAt.getTime() === incoming.calculatedAt.getTime()
  );
}

function toCreateData(
  readModel: CourseProgressReadModel,
): PersistedCourseProgressReadModel {
  return {
    enrollmentId: readModel.enrollmentId,
    courseVersionId: readModel.courseVersionId,
    totalLearningUnits: readModel.totalLearningUnits,
    startedLearningUnits: readModel.startedLearningUnits,
    completedLearningUnits: readModel.completedLearningUnits,
    percentage: readModel.percentage,
    hasLearningUnits: readModel.hasLearningUnits,
    calculatedAt: readModel.calculatedAt,
  };
}

@Injectable()
export class PrismaCourseProgressReadModelRepository implements CourseProgressReadModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEnrollmentId(
    enrollmentId: string,
  ): Promise<CourseProgressReadModel | null> {
    return withPrismaRepositoryErrorBoundary(
      'CourseProgressReadModelRepository.findByEnrollmentId',
      async () => {
        const row = await this.prisma.courseProgressReadModel.findUnique({
          where: { enrollmentId },
        });

        return row === null ? null : toDomain(row);
      },
    );
  }

  async save(
    readModel: CourseProgressReadModel,
  ): Promise<CourseProgressReadModelSaveResult> {
    const transactionResult = await withPrismaRepositoryErrorBoundary(
      'CourseProgressReadModelRepository.save',
      async (): Promise<SaveTransactionResult> =>
        withSerializableTransactionRetry(() =>
          this.prisma.$transaction(
            async (tx): Promise<SaveTransactionResult> => {
              /*
               * Lock the authoritative Enrollment row. This serializes
               * projection writes for the same enrollment, including when
               * the projection row does not exist yet.
               */
              const enrollmentRows = await tx.$queryRaw<LockedEnrollmentRow[]>`
                SELECT "id", "courseVersionId"
                FROM "Enrollment"
                WHERE "id" = ${readModel.enrollmentId}
                FOR UPDATE
              `;

              const enrollment = enrollmentRows[0];

              if (enrollment === undefined) {
                return {
                  kind: 'missing-enrollment',
                  enrollmentId: readModel.enrollmentId,
                };
              }

              if (enrollment.courseVersionId !== readModel.courseVersionId) {
                return {
                  kind: 'conflict',
                  error: new CourseProgressReadModelVersionConflictError({
                    enrollmentId: readModel.enrollmentId,
                    existingCourseVersionId: enrollment.courseVersionId,
                    incomingCourseVersionId: readModel.courseVersionId,
                  }),
                };
              }

              const existing = await tx.courseProgressReadModel.findUnique({
                where: { enrollmentId: readModel.enrollmentId },
              });

              if (existing === null) {
                const created = await tx.courseProgressReadModel.create({
                  data: toCreateData(readModel),
                });

                return {
                  kind: 'saved',
                  result: {
                    outcome: 'created',
                    readModel: toDomain(created),
                  },
                };
              }

              if (existing.courseVersionId !== readModel.courseVersionId) {
                return {
                  kind: 'conflict',
                  error: new CourseProgressReadModelVersionConflictError({
                    enrollmentId: readModel.enrollmentId,
                    existingCourseVersionId: existing.courseVersionId,
                    incomingCourseVersionId: readModel.courseVersionId,
                  }),
                };
              }

              const existingTime = existing.calculatedAt.getTime();
              const incomingTime = readModel.calculatedAt.getTime();

              if (incomingTime < existingTime) {
                return {
                  kind: 'saved',
                  result: {
                    outcome: 'stale',
                    readModel: toDomain(existing),
                  },
                };
              }

              if (incomingTime === existingTime) {
                if (sameSnapshot(existing, readModel)) {
                  return {
                    kind: 'saved',
                    result: {
                      outcome: 'unchanged',
                      readModel: toDomain(existing),
                    },
                  };
                }

                return {
                  kind: 'conflict',
                  error: new CourseProgressReadModelTimestampConflictError({
                    enrollmentId: readModel.enrollmentId,
                    calculatedAt: readModel.calculatedAt,
                  }),
                };
              }

              const updated = await tx.courseProgressReadModel.update({
                where: { enrollmentId: readModel.enrollmentId },
                data: {
                  courseVersionId: readModel.courseVersionId,
                  totalLearningUnits: readModel.totalLearningUnits,
                  startedLearningUnits: readModel.startedLearningUnits,
                  completedLearningUnits: readModel.completedLearningUnits,
                  percentage: readModel.percentage,
                  hasLearningUnits: readModel.hasLearningUnits,
                  calculatedAt: readModel.calculatedAt,
                },
              });

              return {
                kind: 'saved',
                result: {
                  outcome: 'updated',
                  readModel: toDomain(updated),
                },
              };
            },
            {
              isolationLevel: 'Serializable',
            },
          ),
        ),
    );

    /*
     * Keep domain and repository errors outside the generic Prisma boundary
     * so callers receive the intended concrete error types.
     */
    if (transactionResult.kind === 'conflict') {
      throw transactionResult.error;
    }

    if (transactionResult.kind === 'missing-enrollment') {
      throw new PrismaRepositoryError(
        `Cannot persist Course Progress for missing enrollment "${transactionResult.enrollmentId}".`,
        PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      );
    }

    return transactionResult.result;
  }
}
