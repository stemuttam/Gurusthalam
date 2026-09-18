import { CourseValidationError } from '../../domain/errors/index.js';

import { Course } from '../../domain/entities/course.js';

import {
  CourseActorId,
  CourseOwnership,
  createCourseOwnershipAssignment,
  type CourseOwnershipAssignmentProps,
} from '../../domain/ownership/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import {
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
  assignCourseOwnershipInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  submitCourseForReviewInputSchema,
  publishCourseInputSchema,
} from '../contracts/course-application.validation.js';

import type {
  AssignCourseOwnershipInput,
  CourseOwnershipAssignmentInput,
  CreateCourseInput,
  GetCourseInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  SaveCourseInput,
  SubmitCourseForReviewInput,
  PublishCourseInput,
  CourseApplicationService,
} from '../contracts/course-application.contracts.js';

export class DefaultCourseApplicationService implements CourseApplicationService {
  constructor(private readonly courseRepository: CourseRepository) {}

  async createCourse(input: CreateCourseInput): Promise<Course> {
    const validatedInput = createCourseInputSchema.parse(input);

    const ownership =
      validatedInput.ownership === undefined
        ? undefined
        : this.toOwnership(validatedInput.ownership);

    const course = Course.create({
      title: validatedInput.title,

      description: validatedInput.description ?? null,

      level: validatedInput.level,

      type: validatedInput.type,

      instructorId: validatedInput.instructorId,

      ...(validatedInput.visibility !== undefined
        ? {
            visibility: validatedInput.visibility,
          }
        : {}),

      ...(ownership !== undefined
        ? {
            ownership,
          }
        : {}),
    });

    await this.courseRepository.save(course);

    return course;
  }

  async getCourse(input: GetCourseInput): Promise<Course | null> {
    const validatedInput = getCourseInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    return this.courseRepository.findById(courseId);
  }

  async courseExists(input: GetCourseInput): Promise<boolean> {
    const validatedInput = courseExistsInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    return this.courseRepository.exists(courseId);
  }

  async saveCourse(input: SaveCourseInput): Promise<void> {
    await this.courseRepository.save(input.course);
  }

  /**
   * Application boundary for assigning Course ownership.
   *
   * Responsibilities:
   * - validate primitive application input;
   * - convert CourseId / CourseActorId into domain value objects;
   * - load the Course aggregate;
   * - invoke the aggregate mutation;
   * - persist the aggregate.
   *
   * Deliberately excluded:
   * - authentication;
   * - identity lookup;
   * - Instructor Profile lookup;
   * - RBAC;
   * - ABAC;
   * - authorization decisions.
   */
  async assignOwnership(input: AssignCourseOwnershipInput): Promise<Course> {
    const validatedInput = assignCourseOwnershipInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const assignment = this.toOwnershipAssignment(validatedInput);

    const course = await this.requireCourse(courseId);

    course.addOwnershipAssignment(assignment);

    await this.courseRepository.save(course);

    return course;
  }

  /**
   * Application boundary for removing one Course ownership assignment.
   *
   * The application service performs a read-before-write check so
   * removing an already absent assignment remains a true no-op:
   * no aggregate timestamp mutation and no repository write.
   */
  async removeOwnership(input: RemoveCourseOwnershipInput): Promise<Course> {
    const validatedInput = removeCourseOwnershipInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const principalId = this.toCourseActorId(validatedInput.principalId);

    const course = await this.requireCourse(courseId);

    if (!course.ownership.has(principalId, validatedInput.role)) {
      return course;
    }

    course.removeOwnershipAssignment(principalId, validatedInput.role);

    await this.courseRepository.save(course);

    return course;
  }

  /**
   * Application boundary for replacing the complete Course ownership
   * collection.
   *
   * The entire target collection is constructed through CourseOwnership
   * before the aggregate is changed. This ensures duplicate-assignment
   * and multiple-OWNER invariants are enforced by the domain rather than
   * duplicated in application logic.
   */
  async replaceOwnership(input: ReplaceCourseOwnershipInput): Promise<Course> {
    const validatedInput = replaceCourseOwnershipInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const ownership = this.toOwnership(validatedInput.assignments);

    const course = await this.requireCourse(courseId);

    if (course.ownership.equals(ownership)) {
      return course;
    }

    course.replaceOwnership(ownership);

    await this.courseRepository.save(course);

    return course;
  }

  /**
   * Application boundary for the Draft → Review workflow command.
   *
   * The application service owns orchestration only:
   * - validate the command;
   * - load the aggregate;
   * - invoke the aggregate lifecycle command;
   * - persist the aggregate.
   *
   * Lifecycle eligibility, mutation, timestamp handling, and the
   * CourseSubmittedForReview domain event remain inside Course.
   *
   * Authorization is deliberately outside this boundary.
   */
  async submitForReview(input: SubmitCourseForReviewInput): Promise<Course> {
    const validatedInput = submitCourseForReviewInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    course.submitForReview();

    await this.courseRepository.save(course);

    return course;
  }

  /**
   * Application boundary for the Review → Publish workflow command.
   *
   * The Course aggregate remains responsible for:
   * - lifecycle eligibility;
   * - publication readiness;
   * - status mutation;
   * - updatedAt mutation;
   * - CoursePublished domain event creation.
   *
   * Authorization is deliberately outside this boundary.
   */
  async publish(input: PublishCourseInput): Promise<Course> {
    const validatedInput = publishCourseInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    course.publish();

    await this.courseRepository.save(course);

    return course;
  }

  private toCourseId(value: string): CourseId {
    return CourseId.from(value);
  }

  private toCourseActorId(value: string): CourseActorId {
    return CourseActorId.from(value);
  }

  private toOwnershipAssignment(
    input: CourseOwnershipAssignmentInput,
  ): CourseOwnershipAssignmentProps {
    return createCourseOwnershipAssignment({
      principalId: this.toCourseActorId(input.principalId),

      role: input.role,
    });
  }

  private toOwnership(
    assignments: readonly CourseOwnershipAssignmentInput[],
  ): CourseOwnership {
    return CourseOwnership.create(
      assignments.map((assignment) => this.toOwnershipAssignment(assignment)),
    );
  }

  private async requireCourse(courseId: CourseId): Promise<Course> {
    const course = await this.courseRepository.findById(courseId);

    if (course === null) {
      throw new CourseValidationError('Course was not found.', [
        {
          field: 'courseId',

          message: 'The specified Course does not exist.',
        },
      ]);
    }

    return course;
  }
}
