import {
  LessonProgress,
  type LessonProgressBatchQueryRepository,
  type LessonProgressProps,
} from '@gurusthalam/learning';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

const FIND_MANY_OPERATION =
  'LessonProgressBatchQueryRepository.findManyByEnrollmentAndLearningUnitIds';

export class PrismaLessonProgressBatchQueryRepository implements LessonProgressBatchQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findManyByEnrollmentAndLearningUnitIds(
    enrollmentId: string,
    learningUnitIds: readonly string[],
  ): Promise<readonly LessonProgress[]> {
    // An empty IN list has no useful query semantics for this use case.
    // Return immediately and avoid an unnecessary database round trip.
    if (learningUnitIds.length === 0) {
      return [];
    }

    // Normalize duplicate request IDs without changing their values.
    const uniqueLearningUnitIds = [...new Set(learningUnitIds)];

    if (uniqueLearningUnitIds.length === 0) {
      return [];
    }

    return withPrismaRepositoryErrorBoundary(FIND_MANY_OPERATION, async () => {
      const records = await this.prisma.lessonProgress.findMany({
        where: {
          enrollmentId,
          learningUnitId: {
            in: uniqueLearningUnitIds,
          },
        },
        orderBy: [{ learningUnitId: 'asc' }, { id: 'asc' }],
      });

      return records.map((record) => this.toDomain(record));
    });
  }

  /**
   * Rehydrates existing persistence state without generating domain events.
   * Keep the mapping aligned with PrismaLessonProgressRepository.
   */
  private toDomain(record: LessonProgressProps): LessonProgress {
    return LessonProgress.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
      learningUnitId: record.learningUnitId,
      status: record.status,
      percentage: record.percentage,
      startedAt: record.startedAt === null ? null : new Date(record.startedAt),
      completedAt:
        record.completedAt === null ? null : new Date(record.completedAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}
