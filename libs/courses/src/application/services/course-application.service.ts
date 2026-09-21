import { Course } from '../../domain/entities/course.js';

import type { UpdateCourseMetadataProps } from '../../domain/entities/course.js';

import { CourseValidationError } from '../../domain/errors/index.js';

import {
  CourseActorId,
  CourseOwnership,
  createCourseOwnershipAssignment,
  type CourseOwnershipAssignmentProps,
} from '../../domain/ownership/index.js';

import type { CourseRepository } from '../../domain/repositories/course-repository.js';

import { CourseId } from '../../domain/value-objects/course-id.js';

import {
  assignCourseOwnershipInputSchema,
  courseExistsInputSchema,
  courseLifecycleCommandInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
  publishCourseInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  requestCourseChangesInputSchema,
  submitCourseForReviewInputSchema,
  updateCourseInputSchema,
  type CourseLifecycleCommandInputSchema,
} from '../contracts/course-application.validation.js';

import type {
  AssignCourseOwnershipInput,
  CourseApplicationService,
  CourseOwnershipAssignmentInput,
  CreateCourseInput,
  GetCourseInput,
  PublishCourseInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  RequestCourseChangesInput,
  SaveCourseInput,
  SubmitCourseForReviewInput,
  UpdateCourseInput,
  UpdateMetadataInput,
} from '../contracts/course-application.contracts.js';

type CourseMetadataSnapshot = Readonly<{
  title: Course['title'];
  description: Course['description'];
  level: Course['level'];
  type: Course['type'];
  visibility: Course['visibility'];
}>;

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
   * Application boundary for updating mutable transactional
   * Course metadata.
   *
   * Responsibilities:
   * - validate primitive application input;
   * - convert the Course identifier to CourseId;
   * - load the Course aggregate;
   * - delegate metadata rules to Course.updateMetadata();
   * - avoid persistence for a semantic no-op;
   * - persist a real metadata transition exactly once.
   *
   * The Course aggregate remains responsible for:
   * - lifecycle eligibility;
   * - metadata invariants;
   * - timestamp mutation;
   * - CourseMetadataUpdated domain-event creation.
   *
   * Authorization is deliberately outside this boundary.
   */
  async updateCourse(input: UpdateCourseInput): Promise<Course> {
    return this.updateMetadata(input);
  }

  /**
   * Canonical application boundary for updating mutable transactional
   * Course metadata.
   *
   * The 4.10-B updateCourse() contract remains as a compatibility alias,
   * while 4.10-E establishes updateMetadata() as the semantically precise
   * command name for this boundary.
   *
   * Responsibilities:
   * - validate primitive application input;
   * - convert the Course identifier to CourseId;
   * - load the Course aggregate;
   * - delegate metadata rules to Course.updateMetadata();
   * - avoid persistence for a semantic no-op;
   * - persist a real metadata transition exactly once.
   *
   * The Course aggregate remains responsible for:
   * - lifecycle eligibility;
   * - metadata invariants;
   * - timestamp mutation;
   * - CourseMetadataUpdated domain-event creation.
   *
   * Authorization is deliberately outside this boundary.
   */
  async updateMetadata(input: UpdateMetadataInput): Promise<Course> {
    const validatedInput = updateCourseInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    const previousMetadata = this.captureCourseMetadata(course);

    course.updateMetadata(this.toCourseMetadataUpdateInput(validatedInput));

    if (!this.hasCourseMetadataChanged(course, previousMetadata)) {
      return course;
    }

    await this.courseRepository.save(course);

    return course;
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
   * Application boundary for the Review → Draft request-changes command.
   *
   * The application service owns orchestration only:
   * - validate the command;
   * - load the aggregate;
   * - invoke the aggregate lifecycle command;
   * - persist the aggregate.
   *
   * Lifecycle eligibility, mutation, timestamp handling, and the
   * CourseChangesRequested domain event remain inside Course.
   *
   * Authorization is deliberately outside this boundary.
   */
  async requestChanges(input: RequestCourseChangesInput): Promise<Course> {
    const validatedInput = requestCourseChangesInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    course.requestChanges();

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

  /**
   * Application boundary for the Published → Unpublished command.
   *
   * Lifecycle eligibility, state mutation, timestamp handling, and
   * CourseUnpublished domain-event creation remain inside Course.
   *
   * Authorization is deliberately outside this boundary.
   */
  async unpublish(input: CourseLifecycleCommandInputSchema): Promise<Course> {
    const validatedInput = courseLifecycleCommandInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    course.unpublish();

    await this.courseRepository.save(course);

    return course;
  }

  /**
   * Application boundary for the archival lifecycle command.
   *
   * The canonical Course lifecycle policy remains the single source
   * of truth for whether the current status may transition to ARCHIVED.
   *
   * Authorization is deliberately outside this boundary.
   */
  async archive(input: CourseLifecycleCommandInputSchema): Promise<Course> {
    const validatedInput = courseLifecycleCommandInputSchema.parse(input);

    const courseId = this.toCourseId(validatedInput.courseId);

    const course = await this.requireCourse(courseId);

    course.archive();

    await this.courseRepository.save(course);

    return course;
  }

  private captureCourseMetadata(course: Course): CourseMetadataSnapshot {
    return {
      title: course.title,

      description: course.description,

      level: course.level,

      type: course.type,

      visibility: course.visibility,
    };
  }

  private hasCourseMetadataChanged(
    course: Course,
    previousMetadata: CourseMetadataSnapshot,
  ): boolean {
    return (
      course.title !== previousMetadata.title ||
      course.description !== previousMetadata.description ||
      course.level !== previousMetadata.level ||
      course.type !== previousMetadata.type ||
      course.visibility !== previousMetadata.visibility
    );
  }

  private toCourseMetadataUpdateInput(
    input: UpdateCourseInput,
  ): UpdateCourseMetadataProps {
    return {
      ...(input.title !== undefined
        ? {
            title: input.title,
          }
        : {}),

      ...(input.description !== undefined
        ? {
            description: input.description,
          }
        : {}),

      ...(input.level !== undefined
        ? {
            level: input.level,
          }
        : {}),

      ...(input.type !== undefined
        ? {
            type: input.type,
          }
        : {}),

      ...(input.visibility !== undefined
        ? {
            visibility: input.visibility,
          }
        : {}),
    };
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
