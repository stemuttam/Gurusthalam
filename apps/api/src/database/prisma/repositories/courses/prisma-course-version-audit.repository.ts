import {
  type CourseVersionAudit,
  type CourseVersionAuditRepository,
  type CourseVersionId,
} from '@gurusthalam/courses';

import {
  type PrismaClient,
} from '@gurusthalam/database';

import {
  CourseVersionAuditPrismaMapper,
} from '../../mappers/courses/course-version-audit-prisma.mapper.js';

import {
  withPrismaRepositoryErrorBoundary,
} from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed persistence adapter for immutable CourseVersion audit facts.
 *
 * The repository is intentionally append-only:
 *
 * - append()
 * - findByCourseVersionId()
 * - findByCourseId()
 *
 * No update or delete operation is exposed.
 */
export class PrismaCourseVersionAuditRepository
  implements CourseVersionAuditRepository
{
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async append(
    audit: CourseVersionAudit,
  ): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseVersionAuditRepository.append',
      async () => {
        const persistence =
          CourseVersionAuditPrismaMapper.toPersistence(
            audit,
          );

        await this.prisma.courseVersionAudit.create(
          {
            data: {
              id:
                persistence.id,

              courseId:
                persistence.courseId,

              courseVersionId:
                persistence.courseVersionId,

              version:
                persistence.version,

              eventType:
                persistence.eventType,

              occurredAt:
                persistence.occurredAt,

              actorType:
                persistence.actorType,

              actorId:
                persistence.actorId,

              reason:
                persistence.reason,

              metadata:
                persistence.metadata,
            },
          },
        );
      },
    );
  }

  async findByCourseVersionId(
    courseVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionAudit[]> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionAuditRepository.findByCourseVersionId',
      async () => {
        const records =
          await this.prisma.courseVersionAudit.findMany(
            {
              where: {
                courseVersionId:
                  courseVersionId.value,
              },

              orderBy: [
                {
                  occurredAt:
                    'asc',
                },
                {
                  id:
                    'asc',
                },
              ],
            },
          );

        return records.map(
          (record) =>
            CourseVersionAuditPrismaMapper.toDomain(
              record,
            ),
        );
      },
    );
  }

  async findByCourseId(
    courseId: string,
  ): Promise<readonly CourseVersionAudit[]> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionAuditRepository.findByCourseId',
      async () => {
        const records =
          await this.prisma.courseVersionAudit.findMany(
            {
              where: {
                courseId,
              },

              orderBy: [
                {
                  occurredAt:
                    'asc',
                },
                {
                  version:
                    'asc',
                },
                {
                  id:
                    'asc',
                },
              ],
            },
          );

        return records.map(
          (record) =>
            CourseVersionAuditPrismaMapper.toDomain(
              record,
            ),
        );
      },
    );
  }
}