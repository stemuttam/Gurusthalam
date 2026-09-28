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
 * Architectural boundary:
 *
 * CourseCatalogProjectionPersistence
 *              ↓
 * PrismaCourseCatalogProjectionPersistence
 *              ↓
 * Prisma
 *              ↓
 * PostgreSQL
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
 *
 * The adapter persists only the already-derived CourseCatalogProjection.
 */
export class PrismaCourseCatalogProjectionPersistence implements CourseCatalogProjectionPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates or replaces the canonical CourseCatalog projection.
   *
   * courseId is the stable projection identity.
   *
   * Replaying the same projection therefore remains safe and idempotent.
   */
  async upsert(projection: CourseCatalogProjection): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseCatalogProjectionPersistence.upsert',
      async () => {
        await this.prisma.courseCatalogProjection.upsert({
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
          },
        });
      },
    );
  }

  /**
   * Returns the canonical persisted CourseCatalog projection.
   *
   * Missing projections are represented by null.
   *
   * Prisma represents the schema-version column as number, whereas the
   * application contract intentionally uses a literal schema version.
   *
   * The adapter therefore validates the persisted version and returns the
   * canonical version constant rather than leaking the wider Prisma number
   * type into the application layer.
   */
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

  /**
   * Removes only the CourseCatalog read projection.
   *
   * This never deletes the transactional Course aggregate.
   */
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
