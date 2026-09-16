import { CourseValidationError } from '../../errors/index.js';
import {
  CourseOwnershipRole,
  type CourseOwnershipRole as CourseOwnershipRoleValue,
} from '../enums/course-ownership-role.js';
import { CourseActorId } from '../identifiers/course-actor-id.js';
import type { CourseOwnershipAssignmentProps } from './course-ownership-assignment.js';

/**
 * Immutable collection of Course ownership assignments.
 *
 * The collection models ownership/authoring participation within the
 * Course bounded context. It does not resolve users, authenticate actors,
 * or evaluate authorization policies.
 *
 * Domain invariants enforced here:
 * - every assignment must be a valid Course ownership assignment;
 * - the same principal cannot hold the same role more than once;
 * - a Course can have at most one OWNER;
 * - insertion order is preserved deterministically.
 *
 * The collection may temporarily contain no OWNER because legacy/partial
 * state may exist before the Course aggregate integration phase establishes
 * stronger lifecycle requirements.
 */
export class CourseOwnership {
  private readonly assignments: readonly CourseOwnershipAssignmentProps[];

  private constructor(assignments: readonly CourseOwnershipAssignmentProps[]) {
    this.validateAssignments(assignments);

    this.assignments = Object.freeze(
      assignments.map((assignment) =>
        Object.freeze({
          principalId: assignment.principalId,
          role: assignment.role,
        }),
      ),
    );

    Object.freeze(this);
  }

  /**
   * Creates an ownership collection from domain assignments.
   */
  static create(
    assignments: readonly CourseOwnershipAssignmentProps[] = [],
  ): CourseOwnership {
    return new CourseOwnership([...assignments]);
  }

  /**
   * Rehydrates persisted ownership assignments.
   */
  static rehydrate(
    assignments: readonly CourseOwnershipAssignmentProps[],
  ): CourseOwnership {
    return new CourseOwnership([...assignments]);
  }

  /**
   * Returns all ownership assignments as a detached readonly array.
   */
  getAssignments(): readonly CourseOwnershipAssignmentProps[] {
    return this.assignments.map((assignment) =>
      Object.freeze({
        principalId: assignment.principalId,
        role: assignment.role,
      }),
    );
  }

  /**
   * Returns the number of ownership assignments.
   */
  get size(): number {
    return this.assignments.length;
  }

  /**
   * Determines whether an equivalent assignment exists.
   */
  has(principalId: CourseActorId, role: CourseOwnershipRoleValue): boolean {
    return this.assignments.some(
      (assignment) =>
        assignment.principalId.equals(principalId) && assignment.role === role,
    );
  }

  /**
   * Returns all assignments for a principal.
   */
  getForPrincipal(
    principalId: CourseActorId,
  ): readonly CourseOwnershipAssignmentProps[] {
    return this.assignments
      .filter((assignment) => assignment.principalId.equals(principalId))
      .map((assignment) =>
        Object.freeze({
          principalId: assignment.principalId,
          role: assignment.role,
        }),
      );
  }

  /**
   * Returns all assignments for a specific role.
   */
  getForRole(
    role: CourseOwnershipRoleValue,
  ): readonly CourseOwnershipAssignmentProps[] {
    return this.assignments
      .filter((assignment) => assignment.role === role)
      .map((assignment) =>
        Object.freeze({
          principalId: assignment.principalId,
          role: assignment.role,
        }),
      );
  }

  /**
   * Returns the single Owner assignment, when present.
   */
  getOwner(): CourseOwnershipAssignmentProps | null {
    const owner = this.assignments.find(
      (assignment) => assignment.role === CourseOwnershipRole.OWNER,
    );

    return owner === undefined
      ? null
      : Object.freeze({
          principalId: owner.principalId,
          role: owner.role,
        });
  }

  /**
   * Returns true when the collection contains at least one OWNER.
   */
  hasOwner(): boolean {
    return this.getOwner() !== null;
  }

  /**
   * Produces a new ownership collection with one additional assignment.
   *
   * The current collection remains unchanged.
   */
  add(assignment: CourseOwnershipAssignmentProps): CourseOwnership {
    this.validateAssignment(assignment);

    if (this.has(assignment.principalId, assignment.role)) {
      throw new CourseValidationError(
        'Course ownership assignment already exists.',
        [
          {
            field: 'assignment',
            message:
              'The same principal cannot be assigned the same Course ownership role more than once.',
          },
        ],
      );
    }

    if (assignment.role === CourseOwnershipRole.OWNER && this.hasOwner()) {
      throw new CourseValidationError(
        'Course ownership already has an Owner.',
        [
          {
            field: 'role',
            message: 'A Course can have at most one OWNER assignment.',
          },
        ],
      );
    }

    return CourseOwnership.create([
      ...this.assignments,
      {
        principalId: assignment.principalId,
        role: assignment.role,
      },
    ]);
  }

  /**
   * Produces a new ownership collection without the supplied assignment.
   *
   * Removing a non-existent assignment is a true no-op and returns an
   * equivalent immutable collection.
   */
  remove(
    principalId: CourseActorId,
    role: CourseOwnershipRoleValue,
  ): CourseOwnership {
    return CourseOwnership.create(
      this.assignments.filter(
        (assignment) =>
          !(
            assignment.principalId.equals(principalId) &&
            assignment.role === role
          ),
      ),
    );
  }

  /**
   * Compares ownership collections by value and order.
   */
  equals(other: CourseOwnership): boolean {
    if (!(other instanceof CourseOwnership)) {
      return false;
    }

    if (this.assignments.length !== other.assignments.length) {
      return false;
    }

    return this.assignments.every((assignment, index) => {
      const otherAssignment = other.assignments[index];

      return (
        otherAssignment !== undefined &&
        assignment.role === otherAssignment.role &&
        assignment.principalId.equals(otherAssignment.principalId)
      );
    });
  }

  private validateAssignments(
    assignments: readonly CourseOwnershipAssignmentProps[],
  ): void {
    const seen = new Set<string>();
    let ownerCount = 0;

    for (const assignment of assignments) {
      this.validateAssignment(assignment);

      const key = `${assignment.principalId.toString()}::${assignment.role}`;

      if (seen.has(key)) {
        throw new CourseValidationError(
          'Course ownership contains duplicate assignments.',
          [
            {
              field: 'assignments',
              message:
                'The same principal cannot hold the same Course ownership role more than once.',
            },
          ],
        );
      }

      seen.add(key);

      if (assignment.role === CourseOwnershipRole.OWNER) {
        ownerCount += 1;
      }
    }

    if (ownerCount > 1) {
      throw new CourseValidationError(
        'Course ownership contains multiple Owners.',
        [
          {
            field: 'assignments',
            message: 'A Course can have at most one OWNER assignment.',
          },
        ],
      );
    }
  }

  private validateAssignment(assignment: CourseOwnershipAssignmentProps): void {
    if (!(assignment.principalId instanceof CourseActorId)) {
      throw new CourseValidationError(
        'Course ownership assignment is invalid.',
        [
          {
            field: 'principalId',
            message:
              'Course ownership principal identifier must be a CourseActorId.',
          },
        ],
      );
    }

    if (
      assignment.role !== CourseOwnershipRole.OWNER &&
      assignment.role !== CourseOwnershipRole.AUTHOR &&
      assignment.role !== CourseOwnershipRole.CO_AUTHOR &&
      assignment.role !== CourseOwnershipRole.EDITOR &&
      assignment.role !== CourseOwnershipRole.REVIEWER &&
      assignment.role !== CourseOwnershipRole.PUBLISHER
    ) {
      throw new CourseValidationError(
        'Course ownership assignment is invalid.',
        [
          {
            field: 'role',
            message:
              'Course ownership role must be a supported CourseOwnershipRole.',
          },
        ],
      );
    }
  }
}
