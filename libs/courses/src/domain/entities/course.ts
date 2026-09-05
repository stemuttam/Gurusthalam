import {
  CourseStatus,
  type CourseStatus as CourseStatusValue,
} from '../enums/course-status.js';
import {
  CourseVisibility,
  type CourseVisibility as CourseVisibilityValue,
} from '../enums/course-visibility.js';
import type { CourseLevel as CourseLevelValue } from '../enums/course-level.js';
import type { CourseType as CourseTypeValue } from '../enums/course-type.js';
import {
  CourseValidationError,
  InvalidCourseStateTransitionError,
} from '../errors/index.js';
import {
  CourseDomainEventName,
  type CourseDomainEvent,
  type CourseCreatedPayload,
  type CourseMetadataUpdatedPayload,
} from '../events/index.js';
import { createDomainEvent } from '../events/domain-event.js';
import { CourseId } from '../value-objects/course-id.js';

export interface CourseProps {
  readonly id: CourseId;
  readonly title: string;
  readonly description: string | null;
  readonly level: CourseLevelValue;
  readonly type: CourseTypeValue;
  readonly visibility: CourseVisibilityValue;
  readonly status: CourseStatusValue;
  readonly instructorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCourseProps {
  readonly title: string;
  readonly description?: string | null;
  readonly level: CourseLevelValue;
  readonly type: CourseTypeValue;
  readonly visibility?: CourseVisibilityValue;
  readonly instructorId: string;
}

export interface UpdateCourseMetadataProps {
  readonly title?: string;
  readonly description?: string | null;
  readonly level?: CourseLevelValue;
  readonly type?: CourseTypeValue;
  readonly visibility?: CourseVisibilityValue;
}

type MutableCourseProps = {
  -readonly [Key in keyof CourseProps]: CourseProps[Key];
};

/**
 * Course aggregate root.
 *
 * The aggregate owns lifecycle, metadata invariants,
 * and pending domain events.
 *
 * It deliberately has no dependency on Prisma, NestJS,
 * HTTP, queues, or other infrastructure concerns.
 */
export class Course {
  private readonly props: MutableCourseProps;

  private readonly domainEvents: CourseDomainEvent[] = [];

  private constructor(props: CourseProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  static create(input: CreateCourseProps): Course {
    const now = new Date();

    const course = new Course({
      id: CourseId.generate(),
      title: input.title,
      description: input.description ?? null,
      level: input.level,
      type: input.type,
      visibility: input.visibility ?? CourseVisibility.PRIVATE,
      status: CourseStatus.DRAFT,
      instructorId: input.instructorId,
      createdAt: now,
      updatedAt: now,
    });

    course.recordCourseCreatedEvent();

    return course;
  }

  /**
   * Rehydrates an aggregate from persistence.
   *
   * Rehydration never creates domain events because no new
   * domain action has occurred.
   */
  static rehydrate(props: CourseProps): Course {
    return new Course(props);
  }

  get id(): CourseId {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get level(): CourseLevelValue {
    return this.props.level;
  }

  get type(): CourseTypeValue {
    return this.props.type;
  }

  get visibility(): CourseVisibilityValue {
    return this.props.visibility;
  }

  get status(): CourseStatusValue {
    return this.props.status;
  }

  get instructorId(): string {
    return this.props.instructorId;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  /**
   * Returns a read-only snapshot of currently pending events.
   *
   * This method does not clear the pending event collection.
   */
  getDomainEvents(): readonly CourseDomainEvent[] {
  return structuredClone(this.domainEvents);
  }

  /**
   * Returns all currently pending events and clears them.
   *
   * This is intended for the application/integration boundary.
   */
  pullDomainEvents(): CourseDomainEvent[] {
  const events = structuredClone(this.domainEvents);

  this.domainEvents.length = 0;

  return events;
  }

  updateMetadata(input: UpdateCourseMetadataProps): void {
    this.assertDraftMetadataMutationAllowed();

    const nextTitle =
      input.title === undefined ? this.props.title : input.title.trim();

    const nextDescription =
      input.description === undefined
        ? this.props.description
        : input.description === null
          ? null
          : input.description.trim();

    const nextLevel =
      input.level === undefined ? this.props.level : input.level;

    const nextType = input.type === undefined ? this.props.type : input.type;

    const nextVisibility =
      input.visibility === undefined ? this.props.visibility : input.visibility;

    this.validateTitle(nextTitle);
    this.validateDescription(nextDescription);

    this.replaceProps({
      title: nextTitle,
      description: nextDescription,
      level: nextLevel,
      type: nextType,
      visibility: nextVisibility,
    });

    this.recordCourseMetadataUpdatedEvent();
  }

  submitForReview(): void {
    const previousStatus = this.props.status;

    this.transitionStatus(CourseStatus.IN_REVIEW);

    this.recordStatusChangedEvent(
      CourseDomainEventName.SUBMITTED_FOR_REVIEW,
      previousStatus,
      this.props.status,
    );
  }

  publish(): void {
    if (this.props.status !== CourseStatus.IN_REVIEW) {
      throw new InvalidCourseStateTransitionError(
        this.props.status,
        CourseStatus.PUBLISHED,
      );
    }

    this.validatePublicationReadiness();

    const previousStatus = this.props.status;

    this.replaceProps({
      status: CourseStatus.PUBLISHED,
    });

    this.recordStatusChangedEvent(
      CourseDomainEventName.PUBLISHED,
      previousStatus,
      this.props.status,
    );
  }

  unpublish(): void {
    if (this.props.status !== CourseStatus.PUBLISHED) {
      throw new InvalidCourseStateTransitionError(
        this.props.status,
        CourseStatus.UNPUBLISHED,
      );
    }

    const previousStatus = this.props.status;

    this.replaceProps({
      status: CourseStatus.UNPUBLISHED,
    });

    this.recordStatusChangedEvent(
      CourseDomainEventName.UNPUBLISHED,
      previousStatus,
      this.props.status,
    );
  }

  archive(): void {
    if (
      this.props.status !== CourseStatus.PUBLISHED &&
      this.props.status !== CourseStatus.UNPUBLISHED
    ) {
      throw new InvalidCourseStateTransitionError(
        this.props.status,
        CourseStatus.ARCHIVED,
      );
    }

    const previousStatus = this.props.status;

    this.replaceProps({
      status: CourseStatus.ARCHIVED,
    });

    this.recordStatusChangedEvent(
      CourseDomainEventName.ARCHIVED,
      previousStatus,
      this.props.status,
    );
  }

  toPrimitives(): CourseProps {
    return {
      id: this.props.id,
      title: this.props.title,
      description: this.props.description,
      level: this.props.level,
      type: this.props.type,
      visibility: this.props.visibility,
      status: this.props.status,
      instructorId: this.props.instructorId,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  private transitionStatus(nextStatus: CourseStatusValue): void {
    if (!this.isValidTransition(this.props.status, nextStatus)) {
      throw new InvalidCourseStateTransitionError(
        this.props.status,
        nextStatus,
      );
    }

    this.replaceProps({
      status: nextStatus,
    });
  }

  private isValidTransition(
    current: CourseStatusValue,
    next: CourseStatusValue,
  ): boolean {
    switch (current) {
      case CourseStatus.DRAFT:
        return next === CourseStatus.IN_REVIEW;

      case CourseStatus.IN_REVIEW:
        return next === CourseStatus.PUBLISHED;

      case CourseStatus.PUBLISHED:
        return (
          next === CourseStatus.UNPUBLISHED || next === CourseStatus.ARCHIVED
        );

      case CourseStatus.UNPUBLISHED:
        return next === CourseStatus.ARCHIVED;

      case CourseStatus.ARCHIVED:
        return false;

      default:
        return false;
    }
  }

  private assertDraftMetadataMutationAllowed(): void {
    if (this.props.status !== CourseStatus.DRAFT) {
      throw new CourseValidationError(
        'Course metadata can only be changed while the Course is in DRAFT status.',
        [
          {
            field: 'status',
            message:
              'Course metadata cannot be changed after the Course leaves DRAFT status.',
          },
        ],
      );
    }
  }

  private validatePublicationReadiness(): void {
    const issues = [];

    if (this.props.title.trim().length === 0) {
      issues.push({
        field: 'title',
        message: 'Course title is required for publication.',
      });
    }

    if (
      this.props.description !== null &&
      this.props.description.trim().length === 0
    ) {
      issues.push({
        field: 'description',
        message: 'Course description cannot be empty.',
      });
    }

    if (issues.length > 0) {
      throw new CourseValidationError(
        'Course is not ready for publication.',
        issues,
      );
    }
  }

  private validateProps(props: CourseProps): void {
    const issues = [];

    if (!props.id) {
      issues.push({
        field: 'id',
        message: 'Course identifier is required.',
      });
    }

    if (!this.isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Course creation timestamp must be a valid Date.',
      });
    }

    if (!this.isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Course update timestamp must be a valid Date.',
      });
    }

    try {
      this.validateTitle(props.title);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    try {
      this.validateDescription(props.description);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    try {
      this.validateInstructorId(props.instructorId);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    if (issues.length > 0) {
      throw new CourseValidationError('Course validation failed.', issues);
    }
  }

  private isValidDate(value: Date): boolean {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  private validateTitle(title: string): void {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new CourseValidationError('Course title is required.', [
        {
          field: 'title',
          message: 'Course title must be a non-empty string.',
        },
      ]);
    }

    if (title.trim().length > 200) {
      throw new CourseValidationError('Course title is too long.', [
        {
          field: 'title',
          message: 'Course title must not exceed 200 characters.',
        },
      ]);
    }
  }

  private validateDescription(description: string | null): void {
    if (description !== null && description.trim().length === 0) {
      throw new CourseValidationError(
        'Course description cannot be an empty string.',
        [
          {
            field: 'description',
            message: 'Course description must be null or a non-empty string.',
          },
        ],
      );
    }

    if (description !== null && description.trim().length > 10_000) {
      throw new CourseValidationError('Course description is too long.', [
        {
          field: 'description',
          message: 'Course description must not exceed 10000 characters.',
        },
      ]);
    }
  }

  private validateInstructorId(instructorId: string): void {
    if (typeof instructorId !== 'string' || instructorId.trim().length === 0) {
      throw new CourseValidationError(
        'Course instructor identifier is required.',
        [
          {
            field: 'instructorId',
            message: 'Instructor identifier must be a non-empty string.',
          },
        ],
      );
    }
  }

  private replaceProps(
    changes: Partial<
      Pick<
        MutableCourseProps,
        'title' | 'description' | 'level' | 'type' | 'visibility' | 'status'
      >
    >,
  ): void {
    Object.assign(this.props, changes);

    this.props.updatedAt = new Date();
  }

  private recordCourseCreatedEvent(): void {
    const payload: CourseCreatedPayload = {
      courseId: this.id.toString(),
      title: this.title,
      description: this.description,
      level: this.level,
      type: this.type,
      visibility: this.visibility,
      status: this.status,
      instructorId: this.instructorId,
    };

    this.domainEvents.push(
      createDomainEvent(
        CourseDomainEventName.CREATED,
        this.id.toString(),
        payload,
        this.props.updatedAt,
      ),
    );
  }

  private recordCourseMetadataUpdatedEvent(): void {
    const payload: CourseMetadataUpdatedPayload = {
      courseId: this.id.toString(),
      title: this.title,
      description: this.description,
      level: this.level,
      type: this.type,
      visibility: this.visibility,
    };

    this.domainEvents.push(
      createDomainEvent(
        CourseDomainEventName.METADATA_UPDATED,
        this.id.toString(),
        payload,
        this.props.updatedAt,
      ),
    );
  }

  private recordStatusChangedEvent(
    eventName:
      | typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW
      | typeof CourseDomainEventName.PUBLISHED
      | typeof CourseDomainEventName.UNPUBLISHED
      | typeof CourseDomainEventName.ARCHIVED,
    previousStatus: CourseStatusValue,
    currentStatus: CourseStatusValue,
  ): void {
    this.domainEvents.push(
      createDomainEvent(eventName, this.id.toString(), {
        courseId: this.id.toString(),
        previousStatus,
        currentStatus,
      }),
    );
  }
}
