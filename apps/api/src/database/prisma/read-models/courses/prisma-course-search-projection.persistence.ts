import type {
  CourseSearchProjection,
  CourseSearchProjectionPersistence,
} from '@gurusthalam/courses';

import { COURSE_SEARCH_PROJECTION_SCHEMA_VERSION } from '@gurusthalam/courses';

import type { PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../../repositories/prisma-repository-error.mapper.js';

/**
 * PostgreSQL/Prisma implementation of the infrastructure-neutral
 * CourseSearchProjectionPersistence contract.
 *
 * Architectural boundary:
 *
 * CourseSearchProjectionPersistence
 *              ↓
 * PrismaCourseSearchProjectionPersistence
 *              ↓
 * Prisma
 *              ↓
 * PostgreSQL
 *
 * The adapter persists an already-derived CourseSearchProjection.
 *
 * Search infrastructure remains replaceable because the application
 * boundary depends only on CourseSearchProjectionPersistence.
 *
 * This adapter deliberately does not:
 * - hydrate Course aggregates;
 * - process domain events;
 * - implement lifecycle rules;
 * - implement authorization;
 * - implement query semantics;
 * - create embeddings;
 * - access vector storage;
 * - access AI models;
 * - perform ranking;
 * - manage agent state.
 */
export class PrismaCourseSearchProjectionPersistence implements CourseSearchProjectionPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates or replaces the persisted CourseSearch projection.
   *
   * courseId is the stable projection identity.
   *
   * Replaying the same projection therefore remains safe.
   */
  async upsert(projection: CourseSearchProjection): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseSearchProjectionPersistence.upsert',
      async () => {
        await this.prisma.courseSearchProjection.upsert({
          where: {
            courseId: projection.courseId,
          },
          create: {
            courseId: projection.courseId,
            title: projection.title,
            description: projection.description,
            level: projection.level,
            type: projection.type,
            visibility: projection.visibility,
            status: projection.status,
            instructorId: projection.instructorId,
            createdAt: new Date(projection.createdAt),
            updatedAt: new Date(projection.updatedAt),
            projectionSchemaVersion: projection.projectionSchemaVersion,
            searchText: projection.searchText,
            searchProjectionSchemaVersion:
              projection.searchProjectionSchemaVersion,
          },
          update: {
            title: projection.title,
            description: projection.description,
            level: projection.level,
            type: projection.type,
            visibility: projection.visibility,
            status: projection.status,
            instructorId: projection.instructorId,
            createdAt: new Date(projection.createdAt),
            updatedAt: new Date(projection.updatedAt),
            projectionSchemaVersion: projection.projectionSchemaVersion,
            searchText: projection.searchText,
            searchProjectionSchemaVersion:
              projection.searchProjectionSchemaVersion,
          },
        });
      },
    );
  }

  /**
   * Finds a persisted CourseSearch projection.
   *
   * Missing projections are represented by null.
   *
   * Prisma represents schema-version columns as number, while the
   * application projection contract intentionally uses a literal schema
   * version. The adapter therefore validates and narrows the persisted
   * value back to the canonical application representation.
   */
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

  /**
   * Removes only the CourseSearch read projection.
   *
   * This never deletes the transactional Course aggregate or the
   * CourseCatalog projection.
   */
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
