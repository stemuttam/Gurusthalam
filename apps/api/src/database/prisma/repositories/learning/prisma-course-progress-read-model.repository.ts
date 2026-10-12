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
      async (): Promise<SaveTransactionResult> => {
        return this.prisma.$transaction(
          async (tx): Promise<SaveTransactionResult> => {
            /*
             * Serialize projection writes for a given enrollment.
             *
             * Locking the authoritative Enrollment row works even when no
             * projection row exists yet, avoiding a first-write race.
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
        );
      },
    );

    /*
     * Business errors are returned as values from the transaction callback
     * and thrown only after the generic repository boundary has completed.
     * This preserves their concrete error types for application callers.
     */
    if (transactionResult.kind === 'conflict') {
      throw transactionResult.error;
    }

    if (transactionResult.kind === 'missing-enrollment') {
      throw new Error(
        `Cannot persist Course Progress for missing enrollment "${transactionResult.enrollmentId}".`,
      );
    }

    return transactionResult.result;
  }
}
