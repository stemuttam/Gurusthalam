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
  createCourseMetadataUpdatedEvent,
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

type CourseMetadataState = Pick<
  CourseProps,
  'title' | 'description' | 'level' | 'type' | 'visibility'
>;

type CourseLifecycleEventName =
  | typeof CourseDomainEventName.SUBMITTED_FOR_REVIEW
  | typeof CourseDomainEventName.PUBLISHED
  | typeof CourseDomainEventName.UNPUBLISHED
  | typeof CourseDomainEventName.ARCHIVED;

type LifecycleTransitionOptions = {
  readonly eventName: CourseLifecycleEventName;
  readonly beforeMutation?: () => void;
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

  /**
   * Creates a new Course aggregate in DRAFT status.
   *
   * Creation is a domain action and therefore records exactly
   * one CourseCreated domain event.
   */
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

  /**
   * Updates transactional Course metadata while the aggregate is in DRAFT.
   *
   * Semantic rule:
   * CourseMetadataUpdated represents an actual metadata state transition.
   *
   * Validation is always performed against the proposed state. If the
   * proposed state is semantically identical to the current aggregate state,
   * the operation becomes a true no-op:
   *
   * - no aggregate mutation
   * - no updatedAt change
   * - no domain event
   */
  updateMetadata(input: UpdateCourseMetadataProps): void {
    this.assertDraftMetadataMutationAllowed();

    const nextMetadata: CourseMetadataState = {
      title: input.title === undefined ? this.props.title : input.title.trim(),
      description:
        input.description === undefined
          ? this.props.description
          : input.description === null
            ? null
            : input.description.trim(),
      level: input.level === undefined ? this.props.level : input.level,
      type: input.type === undefined ? this.props.type : input.type,
      visibility:
        input.visibility === undefined
          ? this.props.visibility
          : input.visibility,
    };

    // Validate before comparing or mutating. Invalid input must always
    // be rejected, even if another representation could resolve to the
    // current aggregate state.
    this.validateTitle(nextMetadata.title);
    this.validateDescription(nextMetadata.description);

    // A metadata event represents a real state transition.
    // Identical resolved metadata is therefore a true no-op.
    if (!this.hasMetadataChanged(nextMetadata)) {
      return;
    }

    this.replaceProps(nextMetadata);

    this.recordCourseMetadataUpdatedEvent();
  }

  /**
   * Moves the Course from DRAFT to IN_REVIEW.
   */
  submitForReview(): void {
    this.transitionStatus(CourseStatus.IN_REVIEW, {
      eventName: CourseDomainEventName.SUBMITTED_FOR_REVIEW,
    });
  }

  /**
   * Publishes the Course after validating both lifecycle eligibility
   * and publication readiness.
   */
  publish(): void {
    this.transitionStatus(CourseStatus.PUBLISHED, {
      eventName: CourseDomainEventName.PUBLISHED,
      beforeMutation: () => this.validatePublicationReadiness(),
    });
  }

  /**
   * Moves a published Course into UNPUBLISHED status.
   */
  unpublish(): void {
    this.transitionStatus(CourseStatus.UNPUBLISHED, {
      eventName: CourseDomainEventName.UNPUBLISHED,
    });
  }

  /**
   * Archives a published or unpublished Course.
   */
  archive(): void {
    this.transitionStatus(CourseStatus.ARCHIVED, {
      eventName: CourseDomainEventName.ARCHIVED,
    });
  }

  /**
   * Returns a persistence-safe snapshot of the aggregate state.
   *
   * Date values are defensively copied so callers cannot mutate
   * the aggregate through returned Date references.
   */
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

  /**
   * Single lifecycle mutation boundary.
   *
   * Every lifecycle transition follows the same atomic sequence:
   *
   * eligibility
   *   -> transition-specific readiness
   *   -> status mutation
   *   -> timestamp mutation
   *   -> exactly one lifecycle event
   *
   * No lifecycle command is allowed to mutate lifecycle state or emit
   * its lifecycle event outside this boundary.
   */
  private transitionStatus(
    nextStatus: CourseStatusValue,
    options: LifecycleTransitionOptions,
  ): void {
    const previousStatus = this.props.status;

    if (!this.isValidTransition(previousStatus, nextStatus)) {
      throw new InvalidCourseStateTransitionError(previousStatus, nextStatus);
    }

    options.beforeMutation?.();

    this.replaceProps({
      status: nextStatus,
    });

    this.recordStatusChangedEvent(
      options.eventName,
      previousStatus,
      this.props.status,
    );
  }

  /**
   * Defines the complete Course lifecycle transition graph.
   *
   * DRAFT -> IN_REVIEW -> PUBLISHED
   *
   * PUBLISHED -> UNPUBLISHED
   * PUBLISHED -> ARCHIVED
   *
   * UNPUBLISHED -> ARCHIVED
   *
   * ARCHIVED is terminal.
   */
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

  /**
   * Transactional Course metadata is mutable only while the Course
   * remains in DRAFT status.
   */
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

  /**
   * Validates the minimum transactional state required before publication.
   *
   * Lifecycle eligibility is intentionally handled separately by
   * transitionStatus().
   */
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

  /**
   * Validates the complete persisted aggregate state during construction.
   *
   * This protects both newly created and rehydrated aggregates from
   * entering an invalid in-memory state.
   */
  private validateProps(props: CourseProps): void {
    const issues = [];

    if (!props.id) {
      issues.push({
        field: 'id',
        message: 'Course identifier is required.',
      });
    }

    const hasValidCreatedAt = this.isValidDate(props.createdAt);
    const hasValidUpdatedAt = this.isValidDate(props.updatedAt);

    if (!hasValidCreatedAt) {
      issues.push({
        field: 'createdAt',
        message: 'Course creation timestamp must be a valid Date.',
      });
    }

    if (!hasValidUpdatedAt) {
      issues.push({
        field: 'updatedAt',
        message: 'Course update timestamp must be a valid Date.',
      });
    }

    if (
      hasValidCreatedAt &&
      hasValidUpdatedAt &&
      props.createdAt.getTime() > props.updatedAt.getTime()
    ) {
      issues.push({
        field: 'updatedAt',
        message:
          'Course update timestamp cannot be earlier than creation timestamp.',
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

  /**
   * Determines whether the proposed transactional metadata represents
   * a real state transition.
   */
  private hasMetadataChanged(nextMetadata: CourseMetadataState): boolean {
    return (
      this.props.title !== nextMetadata.title ||
      this.props.description !== nextMetadata.description ||
      this.props.level !== nextMetadata.level ||
      this.props.type !== nextMetadata.type ||
      this.props.visibility !== nextMetadata.visibility
    );
  }

  /**
   * Applies aggregate state changes and advances updatedAt.
   *
   * This method is intentionally internal so all domain mutation remains
   * behind explicit aggregate behaviors.
   */
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

  /**
   * Records the single creation event generated by Course.create().
   */
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

  /**
   * Records a metadata event only after a real metadata transition.
   */
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
      createCourseMetadataUpdatedEvent(
        this.id.toString(),
        payload,
        this.props.updatedAt,
      ),
    );
  }

  /**
   * Records the lifecycle event associated with a successful lifecycle
   * transition.
   *
   * The event receives the same updatedAt timestamp produced by
   * replaceProps(), preserving aggregate/event chronology.
   */
  private recordStatusChangedEvent(
    eventName: CourseLifecycleEventName,
    previousStatus: CourseStatusValue,
    currentStatus: CourseStatusValue,
  ): void {
    this.domainEvents.push(
      createDomainEvent(
        eventName,
        this.id.toString(),
        {
          courseId: this.id.toString(),
          previousStatus,
          currentStatus,
        },
        this.props.updatedAt,
      ),
    );
  }
}
