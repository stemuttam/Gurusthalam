import {
  CourseActorId,
  createCourseOwnershipAssignment,
  type CourseOwnership,
  type CourseOwnershipAssignmentProps,
  type CourseOwnershipRole,
} from '@gurusthalam/courses';

import type {
  CourseOwnershipAssignmentModel,
  CourseOwnershipRole as PrismaCourseOwnershipRole,
} from '@gurusthalam/database';

export type PrismaCourseOwnershipAssignmentRecord =
  CourseOwnershipAssignmentModel;

export interface PrismaCourseOwnershipPersistence {
  readonly courseId: string;
  readonly principalId: string;
  readonly role: PrismaCourseOwnershipRole;
  readonly position: number;
}

/**
 * Maps the Course-domain ownership value object to the Prisma
 * persistence boundary.
 *
 * This mapper intentionally contains no authorization logic and
 * no identity-resolution logic.
 */
export class CourseOwnershipPrismaMapper {
  private constructor() {
    // Static mapper; instantiation is intentionally disabled.
  }

  static toDomain(
    record: PrismaCourseOwnershipAssignmentRecord,
  ): CourseOwnershipAssignmentProps {
    return createCourseOwnershipAssignment({
      principalId: CourseActorId.from(record.principalId),
      role: CourseOwnershipPrismaMapper.toDomainRole(record.role),
    });
  }

  static toDomainMany(
    records: readonly PrismaCourseOwnershipAssignmentRecord[],
  ): CourseOwnershipAssignmentProps[] {
    return [...records]
      .sort((left, right) => left.position - right.position)
      .map((record) =>
        CourseOwnershipPrismaMapper.toDomain(record),
      );
  }

  static toPersistence(
    courseId: string,
    assignment: CourseOwnershipAssignmentProps,
    position: number,
  ): PrismaCourseOwnershipPersistence {
    return {
      courseId,
      principalId: assignment.principalId.toString(),
      role: CourseOwnershipPrismaMapper.toPrismaRole(
        assignment.role,
      ),
      position,
    };
  }

  static toPersistenceMany(
    courseId: string,
    ownership: CourseOwnership,
  ): PrismaCourseOwnershipPersistence[] {
    return ownership
      .getAssignments()
      .map((assignment, position) =>
        CourseOwnershipPrismaMapper.toPersistence(
          courseId,
          assignment,
          position,
        ),
      );
  }

  private static toDomainRole(
    value: PrismaCourseOwnershipRole,
  ): CourseOwnershipRole {
    switch (value) {
      case 'OWNER':
        return 'OWNER';

      case 'AUTHOR':
        return 'AUTHOR';

      case 'CO_AUTHOR':
        return 'CO_AUTHOR';

      case 'EDITOR':
        return 'EDITOR';

      case 'REVIEWER':
        return 'REVIEWER';

      case 'PUBLISHER':
        return 'PUBLISHER';

      default:
        throw new TypeError(
          `Unsupported Prisma CourseOwnershipRole: ${String(value)}`,
        );
    }
  }

  private static toPrismaRole(
    value: CourseOwnershipRole,
  ): PrismaCourseOwnershipRole {
    switch (value) {
      case 'OWNER':
        return 'OWNER';

      case 'AUTHOR':
        return 'AUTHOR';

      case 'CO_AUTHOR':
        return 'CO_AUTHOR';

      case 'EDITOR':
        return 'EDITOR';

      case 'REVIEWER':
        return 'REVIEWER';

      case 'PUBLISHER':
        return 'PUBLISHER';

      default:
        throw new TypeError(
          `Unsupported domain CourseOwnershipRole: ${String(value)}`,
        );
    }
  }
}