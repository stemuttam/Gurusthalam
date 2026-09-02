import {
  type CourseId,
  type CourseVersion,
  type CourseVersionId,
  type CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  type PrismaClient,
} from '@gurusthalam/database';

import {
  CourseVersionPrismaMapper,
} from '../../mappers/courses/index.js';

/**
 * Prisma-backed implementation of the domain
 * CourseVersionRepository.
 *
 * The implementation deliberately keeps all Prisma-specific
 * concerns inside the infrastructure layer.
 */
export class PrismaCourseVersionRepository
  implements CourseVersionRepository
{
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Finds a CourseVersion by its identifier.
   */
  async findById(
    id: CourseVersionId,
  ): Promise<CourseVersion | null> {
    const record =
      await this.prisma.courseVersion.findUnique({
        where: {
          id: id.value,
        },
      });

    if (record === null) {
      return null;
    }

    return CourseVersionPrismaMapper.toDomain(
      record,
    );
  }

  /**
   * Finds the latest CourseVersion for a Course.
   *
   * Latest is determined by the domain version number,
   * not createdAt or updatedAt.
   */
  async findLatestByCourseId(
    courseId: CourseId,
  ): Promise<CourseVersion | null> {
    const record =
      await this.prisma.courseVersion.findFirst({
        where: {
          courseId: courseId.value,
        },
        orderBy: {
          version: 'desc',
        },
      });

    if (record === null) {
      return null;
    }

    return CourseVersionPrismaMapper.toDomain(
      record,
    );
  }

  /**
   * Finds the currently published CourseVersion.
   *
   * The status predicate is authoritative.
   *
   * Ordering by version descending provides deterministic
   * behavior even if legacy or inconsistent data temporarily
   * contains more than one published version.
   */
  async findPublishedByCourseId(
    courseId: CourseId,
  ): Promise<CourseVersion | null> {
    const record =
      await this.prisma.courseVersion.findFirst({
        where: {
          courseId: courseId.value,
          status: 'PUBLISHED',
        },
        orderBy: {
          version: 'desc',
        },
      });

    if (record === null) {
      return null;
    }

    return CourseVersionPrismaMapper.toDomain(
      record,
    );
  }

  /**
   * Determines whether a specific version number already
   * exists for a Course.
   *
   * Uses the Prisma composite unique constraint:
   * (courseId, version).
   */
  async existsByCourseIdAndVersion(
    courseId: CourseId,
    version: number,
  ): Promise<boolean> {
    const record =
      await this.prisma.courseVersion.findUnique({
        where: {
          courseId_version: {
            courseId: courseId.value,
            version,
          },
        },
        select: {
          id: true,
        },
      });

    return record !== null;
  }

  /**
   * Persists a CourseVersion.
   *
   * Upsert is performed by immutable CourseVersion identity.
   * Course association and version number are preserved during
   * updates because the domain does not expose mutation operations
   * for those values.
   */
  async save(
    courseVersion: CourseVersion,
  ): Promise<void> {
    const persistence =
      CourseVersionPrismaMapper.toPersistence(
        courseVersion,
      );

    await this.prisma.courseVersion.upsert({
      where: {
        id: persistence.id,
      },
      create: {
        id: persistence.id,
        courseId: persistence.courseId,
        version: persistence.version,
        status: persistence.status,
        title: persistence.title,
        description: persistence.description,
        createdAt: persistence.createdAt,
        updatedAt: persistence.updatedAt,
        publishedAt: persistence.publishedAt,
      },
      update: {
        status: persistence.status,
        title: persistence.title,
        description: persistence.description,
        updatedAt: persistence.updatedAt,
        publishedAt: persistence.publishedAt,
      },
    });
  }
}