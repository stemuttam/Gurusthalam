import {
  Prisma,
  type PrismaClient,
} from '@gurusthalam/database';

import type {
  CourseId,
  CourseVersion,
  CourseVersionAudit,
  CourseVersionId,
  CourseVersionLineage,
  CourseVersionRollbackPersistence,
  CourseVersionRollbackTransactionContext,
} from '@gurusthalam/courses';

import {
  CourseVersionPrismaMapper,
} from '../mappers/courses/course-version-prisma.mapper.js';

import {
  CourseVersionLineagePrismaMapper,
} from '../mappers/courses/course-version-lineage-prisma.mapper.js';

import {
  CourseVersionAuditPrismaMapper,
} from '../mappers/courses/course-version-audit-prisma.mapper.js';

import {
  withPrismaRepositoryErrorBoundary,
} from '../repositories/prisma-repository-error.mapper.js';

export const COURSE_VERSION_ROLLBACK_PERSISTENCE =
  Symbol(
    'COURSE_VERSION_ROLLBACK_PERSISTENCE',
  );

export class PrismaCourseVersionRollbackTransaction
  implements CourseVersionRollbackPersistence
{
  constructor(
    private readonly prisma:
      PrismaClient,
  ) {}

  async execute<T>(
    work: (
      context:
        CourseVersionRollbackTransactionContext,
    ) => Promise<T>,
  ): Promise<T> {
    return withPrismaRepositoryErrorBoundary(
      'CourseVersionRollbackPersistence.execute',
      async () =>
        this.prisma.$transaction(
          async (
            transaction,
          ) => {
            const context =
              this.createContext(
                transaction,
              );

            return work(
              context,
            );
          },
        ),
    );
  }

  private createContext(
    transaction:
      Prisma.TransactionClient,
  ): CourseVersionRollbackTransactionContext {
    return {
      findVersionById:
        async (
          id: CourseVersionId,
        ): Promise<CourseVersion | null> => {
          const record =
            await transaction.courseVersion.findUnique({
              where: {
                id:
                  id.value,
              },
            });

          if (
            record === null
          ) {
            return null;
          }

          return CourseVersionPrismaMapper.toDomain(
            record,
          );
        },

      findLatestVersionByCourseId:
        async (
          courseId: CourseId,
        ): Promise<CourseVersion | null> => {
          const record =
            await transaction.courseVersion.findFirst({
              where: {
                courseId:
                  courseId.value,
              },

              orderBy: {
                version:
                  'desc',
              },
            });

          if (
            record === null
          ) {
            return null;
          }

          return CourseVersionPrismaMapper.toDomain(
            record,
          );
        },

      saveVersion:
        async (
          version: CourseVersion,
        ): Promise<void> => {
          const persistence =
            CourseVersionPrismaMapper.toPersistence(
              version,
            );

          await transaction.courseVersion.create({
            data: {
              id:
                persistence.id,

              courseId:
                persistence.courseId,

              version:
                persistence.version,

              status:
                persistence.status,

              title:
                persistence.title,

              description:
                persistence.description,

              createdAt:
                persistence.createdAt,

              updatedAt:
                persistence.updatedAt,

              publishedAt:
                persistence.publishedAt,
            },
          });
        },

      appendLineage:
        async (
          lineage: CourseVersionLineage,
        ): Promise<void> => {
          const persistence =
            CourseVersionLineagePrismaMapper.toPersistence(
              lineage,
            );

          await transaction.courseVersionLineage.create({
            data: {
              courseId:
                persistence.courseId,

              sourceVersionId:
                persistence.sourceVersionId,

              sourceVersion:
                persistence.sourceVersion,

              targetVersionId:
                persistence.targetVersionId,

              targetVersion:
                persistence.targetVersion,

              relation:
                persistence.relation,

              reason:
                persistence.reason,
            },
          });
        },

      appendAudit:
        async (
          audit: CourseVersionAudit,
        ): Promise<void> => {
          const persistence =
            CourseVersionAuditPrismaMapper.toPersistence(
              audit,
            );

          await transaction.courseVersionAudit.create({
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
          });
        },
    };
  }
}