import type {
  CourseVersionId,
  CourseVersionLineage,
  CourseVersionLineageRepository,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { CourseVersionLineagePrismaMapper } from '../../mappers/courses/course-version-lineage-prisma.mapper.js';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

/**
 * Prisma persistence adapter for immutable CourseVersion lineage.
 *
 * The adapter is append-only by design.
 */
export class PrismaCourseVersionLineageRepository implements CourseVersionLineageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(lineage: CourseVersionLineage): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseVersionLineageRepository.append',
      async () => {
        const persistence =
          CourseVersionLineagePrismaMapper.toPersistence(lineage);

        await this.prisma.courseVersionLineage.create({
          data: {
            courseId: persistence.courseId,

            sourceVersionId: persistence.sourceVersionId,

            sourceVersion: persistence.sourceVersion,

            targetVersionId: persistence.targetVersionId,

            targetVersion: persistence.targetVersion,

            relation: persistence.relation,

            reason: persistence.reason,
          },
        });
      },
    );
  }

  async findBySourceVersionId(
    sourceVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionLineage[]> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionLineageRepository.findBySourceVersionId',
      async () => {
        const records = await this.prisma.courseVersionLineage.findMany({
          where: {
            sourceVersionId: sourceVersionId.value,
          },

          orderBy: [
            {
              targetVersion: 'asc',
            },
            {
              targetVersionId: 'asc',
            },
          ],
        });

        return records.map((record) =>
          CourseVersionLineagePrismaMapper.toDomain(record),
        );
      },
    );
  }

  async findByTargetVersionId(
    targetVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionLineage[]> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionLineageRepository.findByTargetVersionId',
      async () => {
        const records = await this.prisma.courseVersionLineage.findMany({
          where: {
            targetVersionId: targetVersionId.value,
          },

          orderBy: [
            {
              sourceVersion: 'asc',
            },
            {
              sourceVersionId: 'asc',
            },
          ],
        });

        return records.map((record) =>
          CourseVersionLineagePrismaMapper.toDomain(record),
        );
      },
    );
  }

  async findByCourseId(
    courseId: string,
  ): Promise<readonly CourseVersionLineage[]> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionLineageRepository.findByCourseId',
      async () => {
        const records = await this.prisma.courseVersionLineage.findMany({
          where: {
            courseId,
          },

          orderBy: [
            {
              targetVersion: 'asc',
            },
            {
              sourceVersion: 'asc',
            },
            {
              targetVersionId: 'asc',
            },
          ],
        });

        return records.map((record) =>
          CourseVersionLineagePrismaMapper.toDomain(record),
        );
      },
    );
  }
}
