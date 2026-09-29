import {
  COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
  type CourseCatalogProjection,
  type CourseCatalogProjectionPersistence,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../../repositories/prisma-repository-error.mapper.js';

/**
 * PostgreSQL/Prisma implementation of the infrastructure-neutral
 * CourseCatalogProjectionPersistence contract.
 *
 * 4.14-G concurrency boundary
 * ----------------------------
 *
 * The timestamp ordering rule is enforced by PostgreSQL itself.
 *
 * We deliberately do NOT implement:
 *
 *   SELECT existing.updatedAt
 *   -> compare in TypeScript
 *   -> Prisma upsert
 *
 * because those are separate database operations and are therefore
 * vulnerable to a concurrent writer racing between the read and write.
 *
 * Instead, upsert() uses PostgreSQL's atomic:
 *
 *   INSERT ... ON CONFLICT (...) DO UPDATE ... WHERE
 *
 * The WHERE predicate compares the persisted row with EXCLUDED.updatedAt
 * inside the same database statement.
 *
 * Therefore:
 *
 * - first writer creates the row;
 * - newer projection replaces older state;
 * - equal-timestamp replay is accepted;
 * - older concurrent projection is rejected;
 * - duplicate replay remains idempotent;
 * - concurrent writers converge on the newest timestamp;
 * - no application-level read/write race can bypass the ordering rule.
 */
export class PrismaCourseCatalogProjectionPersistence implements CourseCatalogProjectionPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomically applies the projection when its timestamp is equal to or
   * newer than the persisted projection.
   *
   * Returns:
   *
   * true
   *   The incoming projection was inserted or became the persisted state.
   *
   * false
   *   PostgreSQL rejected the incoming projection because an existing
   *   projection has a strictly newer updatedAt.
   *
   * The ordering decision is made inside PostgreSQL, not in application
   * memory.
   */
  async upsert(projection: CourseCatalogProjection): Promise<boolean> {
    return withPrismaRepositoryErrorBoundary(
      'CourseCatalogProjectionPersistence.upsert',
      async () => {
        const result = await this.prisma.$executeRaw`
          INSERT INTO "CourseCatalogProjection" (
            "courseId",
            "title",
            "description",
            "level",
            "type",
            "visibility",
            "status",
            "instructorId",
            "createdAt",
            "updatedAt",
            "projectionSchemaVersion"
          )
          VALUES (
            ${projection.courseId},
            ${projection.title},
            ${projection.description},
            ${projection.level}::"CourseLevel",
            ${projection.type}::"CourseType",
            ${projection.visibility}::"CourseVisibility",
            ${projection.status}::"CourseStatus",
            ${projection.instructorId},
            ${new Date(projection.createdAt)},
            ${new Date(projection.updatedAt)},
            ${projection.projectionSchemaVersion}
          )
          ON CONFLICT ("courseId")
          DO UPDATE
          SET
            "title" = EXCLUDED."title",
            "description" = EXCLUDED."description",
            "level" = EXCLUDED."level",
            "type" = EXCLUDED."type",
            "visibility" = EXCLUDED."visibility",
            "status" = EXCLUDED."status",
            "instructorId" = EXCLUDED."instructorId",
            "createdAt" = EXCLUDED."createdAt",
            "updatedAt" = EXCLUDED."updatedAt",
            "projectionSchemaVersion" = EXCLUDED."projectionSchemaVersion"
          WHERE "CourseCatalogProjection"."updatedAt" <= EXCLUDED."updatedAt"
        `;

        /*
         * PostgreSQL reports:
         *
         * 1 -> INSERT or UPDATE actually occurred.
         * 0 -> ON CONFLICT matched an existing row, but the ordering
         *      predicate rejected the update because the persisted
         *      timestamp was newer.
         */
        return result === 1;
      },
    );
  }

  async findByCourseId(
    courseId: string,
  ): Promise<CourseCatalogProjection | null> {
    return withPrismaRepositoryErrorBoundary(
      'CourseCatalogProjectionPersistence.findByCourseId',
      async () => {
        const record = await this.prisma.courseCatalogProjection.findUnique({
          where: {
            courseId,
          },
        });

        if (record === null) {
          return null;
        }

        if (
          record.projectionSchemaVersion !==
          COURSE_CATALOG_PROJECTION_SCHEMA_VERSION
        ) {
          throw new Error(
            `Unsupported CourseCatalog projection schema version: ${record.projectionSchemaVersion}. Expected ${COURSE_CATALOG_PROJECTION_SCHEMA_VERSION}.`,
          );
        }

        return {
          courseId: record.courseId,
          title: record.title,
          description: record.description,
          level: record.level,
          type: record.type,
          visibility: record.visibility,
          status: record.status,
          instructorId: record.instructorId,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
          projectionSchemaVersion: COURSE_CATALOG_PROJECTION_SCHEMA_VERSION,
        };
      },
    );
  }

  async removeByCourseId(courseId: string): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseCatalogProjectionPersistence.removeByCourseId',
      async () => {
        await this.prisma.courseCatalogProjection.deleteMany({
          where: {
            courseId,
          },
        });
      },
    );
  }
}
