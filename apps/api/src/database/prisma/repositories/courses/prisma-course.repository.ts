import {
  type Course,
  type CourseId,
  type CourseRepository,
} from '@gurusthalam/courses';

import {
  type PrismaClient,
} from '@gurusthalam/database';

import {
  CoursePrismaMapper,
} from '../../mappers/courses/index.js';

import {
  withPrismaRepositoryErrorBoundary,
} from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed implementation of the domain CourseRepository.
 *
 * This adapter is the infrastructure boundary between the
 * Course domain aggregate and PostgreSQL persistence through Prisma.
 *
 * Prisma types and persistence concerns intentionally remain outside
 * the Course domain package.
 */
export class PrismaCourseRepository
  implements CourseRepository
{
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Finds a Course by its domain identifier.
   *
   * Returns null when the Course does not exist.
   */
  async findById(
    id: CourseId,
  ): Promise<Course | null> {
    return withPrismaRepositoryErrorBoundary(
      'CourseRepository.findById',
      async () => {
        const record =
          await this.prisma.course.findUnique({
            where: {
              id: id.value,
            },
          });

        if (record === null) {
          return null;
        }

        return CoursePrismaMapper.toDomain(
          record,
        );
      },
    );
  }

  /**
   * Determines whether a Course exists.
   *
   * Uses a lightweight existence query instead of hydrating
   * the complete aggregate.
   */
  async exists(
    id: CourseId,
  ): Promise<boolean> {
    return withPrismaRepositoryErrorBoundary(
      'CourseRepository.exists',
      async () => {
        const record =
          await this.prisma.course.findUnique({
            where: {
              id: id.value,
            },
            select: {
              id: true,
            },
          });

        return record !== null;
      },
    );
  }

  /**
   * Persists the Course aggregate.
   *
   * Upsert by aggregate identifier makes save idempotent while
   * preserving immutable identity and creation timestamp on updates.
   */
  async save(
    course: Course,
  ): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'CourseRepository.save',
      async () => {
        const persistence =
          CoursePrismaMapper.toPersistence(
            course,
          );

        await this.prisma.course.upsert({
          where: {
            id: persistence.id,
          },
          create: {
            id: persistence.id,
            title: persistence.title,
            description:
              persistence.description,
            level: persistence.level,
            type: persistence.type,
            visibility:
              persistence.visibility,
            status: persistence.status,
            instructorId:
              persistence.instructorId,
            createdAt:
              persistence.createdAt,
            updatedAt:
              persistence.updatedAt,
          },
          update: {
            title: persistence.title,
            description:
              persistence.description,
            level: persistence.level,
            type: persistence.type,
            visibility:
              persistence.visibility,
            status: persistence.status,
            instructorId:
              persistence.instructorId,
            updatedAt:
              persistence.updatedAt,
          },
        });
      },
    );
  }
}