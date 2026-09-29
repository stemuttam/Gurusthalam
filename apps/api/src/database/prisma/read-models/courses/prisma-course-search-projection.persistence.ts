import {
  COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
  type CourseSearchProjection,
  type CourseSearchProjectionPersistence,
} from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../../repositories/prisma-repository-error.mapper.js';

/**
 * PostgreSQL/Prisma implementation of the infrastructure-neutral
 * CourseSearchProjectionPersistence contract.
 *
 * The search projection follows the same database-level ordering boundary
 * as CourseCatalogProjectionPersistence.
 *
 * PostgreSQL is the concurrency authority:
 *
 *   INSERT ... ON CONFLICT ... DO UPDATE ... WHERE
 *
 * The timestamp comparison therefore cannot be bypassed by a concurrent
 * application-level read/write race.
 */
export class PrismaCourseSearchProjectionPersistence implements CourseSearchProjectionPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomically applies the projection when its timestamp is equal to or
   * newer than the persisted projection.
   *
   * Returns false only when an existing persisted projection has a strictly
   * newer updatedAt.
   */
  async upsert(projection: CourseSearchProjection): Promise<boolean> {
    return withPrismaRepositoryErrorBoundary(
      'CourseSearchProjectionPersistence.upsert',
      async () => {
        const result = await this.prisma.$executeRaw`
          INSERT INTO "CourseSearchProjection" (
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
            "projectionSchemaVersion",
            "searchText",
            "searchProjectionSchemaVersion"
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
            ${projection.projectionSchemaVersion},
            ${projection.searchText},
            ${projection.searchProjectionSchemaVersion}
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
            "projectionSchemaVersion" = EXCLUDED."projectionSchemaVersion",
            "searchText" = EXCLUDED."searchText",
            "searchProjectionSchemaVersion" =
              EXCLUDED."searchProjectionSchemaVersion"
          WHERE "CourseSearchProjection"."updatedAt" <= EXCLUDED."updatedAt"
        `;

        return result === 1;
      },
    );
  }

  async findByCourseId(
    courseId: string,
  ): Promise<CourseSearchProjection | null> {
    return withPrismaRepositoryErrorBoundary(
      'CourseSearchProjectionPersistence.findByCourseId',
      async () => {
        const record = await this.prisma.courseSearchProjection.findUnique({
          where: {
            courseId,
          },
        });

        if (record === null) {
          return null;
        }

        if (
          record.projectionSchemaVersion !==
          COURSE_SEARCH_PROJECTION_SCHEMA_VERSION
        ) {
          throw new Error(
            `Unsupported CourseSearch projection schema version: ${record.projectionSchemaVersion}. Expected ${COURSE_SEARCH_PROJECTION_SCHEMA_VERSION}.`,
          );
        }

        if (
          record.searchProjectionSchemaVersion !==
          COURSE_SEARCH_PROJECTION_SCHEMA_VERSION
        ) {
          throw new Error(
            `Unsupported CourseSearch search projection schema version: ${record.searchProjectionSchemaVersion}. Expected ${COURSE_SEARCH_PROJECTION_SCHEMA_VERSION}.`,
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
          projectionSchemaVersion: COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
          searchText: record.searchText,
          searchProjectionSchemaVersion:
            COURSE_SEARCH_PROJECTION_SCHEMA_VERSION,
        };
      },
    );
  }

  async removeByCourseId(courseId: string): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseSearchProjectionPersistence.removeByCourseId',
      async () => {
        await this.prisma.courseSearchProjection.deleteMany({
          where: {
            courseId,
          },
        });
      },
    );
  }
}
