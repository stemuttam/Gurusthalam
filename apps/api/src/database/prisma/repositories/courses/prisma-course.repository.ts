import {
  type Course,
  type CourseId,
  type CourseRepository,
} from '@gurusthalam/courses';

import type {
  PrismaClient,
} from '@gurusthalam/database';

import {
  CourseOwnershipPrismaMapper,
  CoursePrismaMapper,
} from '../../mappers/courses/index.js';

import {
  withPrismaRepositoryErrorBoundary,
} from '../prisma-repository-error.mapper.js';

/**
 * Prisma-backed implementation of the domain CourseRepository.
 *
 * This adapter is the infrastructure boundary between the
 * Course aggregate and PostgreSQL persistence through Prisma.
 *
 * Ownership persistence is synchronized in the same database
 * transaction as the Course row so Course state and ownership
 * state cannot be committed independently.
 *
 * Prisma types and persistence concerns intentionally remain
 * outside the Course domain package.
 */
export class PrismaCourseRepository
  implements CourseRepository
{
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Finds a Course by its domain identifier and rehydrates
   * the aggregate together with its ownership assignments.
   *
   * Ownership assignments are retrieved in deterministic position
   * order so the domain value object preserves its established ordering.
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
            include: {
              ownershipAssignments: {
                orderBy: {
                  position: 'asc',
                },
              },
            },
          });

        if (record === null) {
          return null;
        }

        return CoursePrismaMapper.toDomain(
          record,
          record.ownershipAssignments,
        );
      },
    );
  }

  /**
   * Determines whether a Course exists.
   *
   * Ownership is deliberately excluded because an existence query
   * should not hydrate the aggregate or join unrelated state.
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
   * Persists the Course aggregate and its ownership state atomically.
   *
   * Ownership synchronization is optimized to avoid rewriting rows when
   * the persisted ordered assignment sequence is already identical to the
   * aggregate state.
   *
   * When ownership does change, the ownership relation is replaced as one
   * atomic state transition. This is intentionally simpler and safer than
   * N individual upserts because Course ownership is a bounded, small
   * cardinality collection and its domain representation already owns all
   * duplicate/Owner invariants.
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

        const ownershipPersistence =
          CourseOwnershipPrismaMapper.toPersistenceMany(
            persistence.id,
            course.ownership,
          );

        await this.prisma.$transaction(
          async (transaction) => {
            await transaction.course.upsert({
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
                status:
                  persistence.status,
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
                status:
                  persistence.status,
                instructorId:
                  persistence.instructorId,
                updatedAt:
                  persistence.updatedAt,
              },
            });

            const currentOwnership =
              await transaction.courseOwnershipAssignment.findMany(
                {
                  where: {
                    courseId:
                      persistence.id,
                  },
                  select: {
                    principalId: true,
                    role: true,
                    position: true,
                  },
                  orderBy: {
                    position: 'asc',
                  },
                },
              );

            if (
              PrismaCourseRepository.areOwnershipAssignmentsEquivalent(
                currentOwnership,
                ownershipPersistence,
              )
            ) {
              return;
            }

            await transaction.courseOwnershipAssignment.deleteMany(
              {
                where: {
                  courseId:
                    persistence.id,
                },
              },
            );

            if (
              ownershipPersistence.length > 0
            ) {
              await transaction.courseOwnershipAssignment.createMany(
                {
                  data:
                    ownershipPersistence,
                },
              );
            }
          },
        );
      },
    );
  }

  /**
   * Compares ownership by deterministic domain sequence.
   *
   * Position values themselves are not compared because persisted
   * positions are an ordering mechanism rather than domain identity.
   */
  private static areOwnershipAssignmentsEquivalent(
    current: readonly {
      readonly principalId: string;
      readonly role: string;
      readonly position: number;
    }[],
    desired: readonly {
      readonly principalId: string;
      readonly role: string;
      readonly position: number;
    }[],
  ): boolean {
    if (
      current.length !==
      desired.length
    ) {
      return false;
    }

    return current.every(
      (assignment, index) => {
        const desiredAssignment =
          desired[index];

        return (
          desiredAssignment !==
            undefined &&
          assignment.principalId ===
            desiredAssignment.principalId &&
          assignment.role ===
            desiredAssignment.role
        );
      },
    );
  }
}