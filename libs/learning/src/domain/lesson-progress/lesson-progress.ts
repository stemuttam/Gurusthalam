import { randomUUID } from 'node:crypto';

import {
  InvalidLessonProgressTransitionError,
  LessonProgressValidationError,
} from './lesson-progress-error.js';

import {
  createLessonProgressCompletedEvent,
  createLessonProgressStartedEvent,
  createLessonProgressUpdatedEvent,
  type LessonProgressCompletedEvent,
  type LessonProgressEvent,
  type LessonProgressStartedEvent,
  type LessonProgressUpdatedEvent,
} from './lesson-progress-events.js';

import {
  LessonProgressStatus,
  type LessonProgressStatus as LessonProgressStatusValue,
} from './lesson-progress-status.js';

export interface LessonProgressProps {
  readonly id: string;
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly status: LessonProgressStatusValue;
  readonly percentage: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateLessonProgressProps {
  readonly enrollmentId: string;
  readonly learningUnitId: string;
  readonly now?: Date;
}

type MutableLessonProgressProps = {
  -readonly [K in keyof LessonProgressProps]: LessonProgressProps[K];
};

const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;

export class LessonProgress {
  private readonly props: MutableLessonProgressProps;

  private readonly domainEvents: LessonProgressEvent[] = [];

  private constructor(props: LessonProgressProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      startedAt: props.startedAt === null ? null : new Date(props.startedAt),
      completedAt:
        props.completedAt === null ? null : new Date(props.completedAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  /**
   * Creates a new LessonProgress aggregate.
   *
   * Creation means that a progress record exists.
   * It does not mean that learning has started.
   *
   * Initial state:
   *
   *   NOT_STARTED
   *   0%
   *   startedAt = null
   *   completedAt = null
   */
  static create(input: CreateLessonProgressProps): LessonProgress {
    const now = input.now === undefined ? new Date() : new Date(input.now);

    if (!isValidDate(now)) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress creation time.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    return new LessonProgress({
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      learningUnitId: input.learningUnitId,
      status: LessonProgressStatus.NOT_STARTED,
      percentage: MIN_PERCENTAGE,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rehydrates LessonProgress from persisted state.
   *
   * Rehydration never creates domain events.
   */
  static rehydrate(props: LessonProgressProps): LessonProgress {
    return new LessonProgress(props);
  }

  get id(): string {
    return this.props.id;
  }

  get enrollmentId(): string {
    return this.props.enrollmentId;
  }

  get learningUnitId(): string {
    return this.props.learningUnitId;
  }

  get status(): LessonProgressStatusValue {
    return this.props.status;
  }

  get percentage(): number {
    return this.props.percentage;
  }

  get startedAt(): Date | null {
    return this.props.startedAt === null
      ? null
      : new Date(this.props.startedAt);
  }

  get completedAt(): Date | null {
    return this.props.completedAt === null
      ? null
      : new Date(this.props.completedAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  /**
   * Starts LessonProgress.
   *
   * Transition:
   *
   *   NOT_STARTED -> IN_PROGRESS
   */
  start(now: Date = new Date()): void {
    if (this.status !== LessonProgressStatus.NOT_STARTED) {
      throw new InvalidLessonProgressTransitionError(
        `Cannot start LessonProgress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${LessonProgressStatus.NOT_STARTED}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);

    this.props.status = LessonProgressStatus.IN_PROGRESS;
    this.props.startedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: LessonProgressStartedEvent = createLessonProgressStartedEvent(
      this.id,
      {
        lessonProgressId: this.id,
        enrollmentId: this.enrollmentId,
        learningUnitId: this.learningUnitId,
        status: this.status,
        percentage: this.percentage,
        startedAt: this.startedAt as Date,
      },
      occurredAt,
    );

    this.domainEvents.push(event);
  }

  /**
   * Updates deterministic LessonProgress percentage.
   *
   * Completion remains an explicit transition.
   *
   * Therefore:
   *
   *   100% != automatically COMPLETED
   *
   * until complete() is explicitly invoked.
   */
  updatePercentage(percentage: number, now: Date = new Date()): void {
    this.validatePercentage(percentage);

    if (this.status === LessonProgressStatus.NOT_STARTED) {
      throw new InvalidLessonProgressTransitionError(
        'LessonProgress must be started before its percentage can be updated.',
        [
          {
            field: 'status',
            message:
              `Expected ${LessonProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.status === LessonProgressStatus.COMPLETED) {
      throw new InvalidLessonProgressTransitionError(
        'Completed LessonProgress cannot be modified.',
        [
          {
            field: 'status',
            message:
              'Completed LessonProgress is terminal and cannot be updated.',
          },
        ],
      );
    }

    if (percentage === this.props.percentage) {
      return;
    }

    const occurredAt = this.validateTransitionDate(now);

    const previousPercentage = this.props.percentage;
    const previousStatus = this.props.status;

    this.props.percentage = percentage;
    this.props.updatedAt = new Date(occurredAt);

    const event: LessonProgressUpdatedEvent = createLessonProgressUpdatedEvent(
      this.id,
      {
        lessonProgressId: this.id,
        enrollmentId: this.enrollmentId,
        learningUnitId: this.learningUnitId,
        previousPercentage,
        currentPercentage: this.percentage,
        previousStatus,
        currentStatus: this.status,
      },
      occurredAt,
    );

    this.domainEvents.push(event);
  }

  /**
   * Explicitly completes LessonProgress.
   *
   * Completion requires 100%.
   *
   * This keeps completion semantics separate from percentage calculation.
   */
  complete(now: Date = new Date()): void {
    if (this.status !== LessonProgressStatus.IN_PROGRESS) {
      throw new InvalidLessonProgressTransitionError(
        `Cannot complete LessonProgress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${LessonProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.percentage !== MAX_PERCENTAGE) {
      throw new InvalidLessonProgressTransitionError(
        'LessonProgress cannot be completed before reaching 100%.',
        [
          {
            field: 'percentage',
            message:
              `Expected ${MAX_PERCENTAGE}, ` + `received ${this.percentage}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);

    const previousStatus = this.status;

    this.props.status = LessonProgressStatus.COMPLETED;
    this.props.completedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: LessonProgressCompletedEvent =
      createLessonProgressCompletedEvent(
        this.id,
        {
          lessonProgressId: this.id,
          enrollmentId: this.enrollmentId,
          learningUnitId: this.learningUnitId,
          previousStatus,
          currentStatus: this.status,
          percentage: this.percentage,
          completedAt: this.completedAt as Date,
        },
        occurredAt,
      );

    this.domainEvents.push(event);
  }

  /**
   * Returns a detached immutable snapshot of pending events.
   *
   * Infrastructure must not drain events until transactional persistence
   * has committed successfully.
   */
  getDomainEvents(): readonly LessonProgressEvent[] {
    return structuredClone(this.domainEvents);
  }

  /**
   * Drains pending domain events.
   *
   * This must be invoked only after:
   *
   *   LessonProgress persistence
   *   +
   *   Outbox persistence
   *
   * have committed successfully.
   */
  pullDomainEvents(): LessonProgressEvent[] {
    const events = structuredClone(this.domainEvents);

    this.domainEvents.length = 0;

    return events;
  }

  /**
   * Returns a detached persistence-safe representation.
   */
  toPrimitives(): LessonProgressProps {
    return {
      id: this.id,
      enrollmentId: this.enrollmentId,
      learningUnitId: this.learningUnitId,
      status: this.status,
      percentage: this.percentage,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private validateTransitionDate(now: Date): Date {
    const value = new Date(now);

    if (!isValidDate(value)) {
      throw new LessonProgressValidationError(
        'LessonProgress transition time is invalid.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    if (value.getTime() < this.props.createdAt.getTime()) {
      throw new LessonProgressValidationError(
        'LessonProgress transition time cannot precede creation time.',
        [
          {
            field: 'now',
            message: 'Transition time must be at or after creation time.',
          },
        ],
      );
    }

    return value;
  }

  private validatePercentage(percentage: number): void {
    if (
      !Number.isInteger(percentage) ||
      percentage < MIN_PERCENTAGE ||
      percentage > MAX_PERCENTAGE
    ) {
      throw new LessonProgressValidationError(
        'LessonProgress percentage is invalid.',
        [
          {
            field: 'percentage',
            message:
              `Percentage must be an integer between ` +
              `${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}.`,
          },
        ],
      );
    }
  }

  private validateProps(props: LessonProgressProps): void {
    const issues: LessonProgressValidationIssue[] = [];

    if (!props.id || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'LessonProgress identifier is required.',
      });
    }

    if (!props.enrollmentId || props.enrollmentId.trim().length === 0) {
      issues.push({
        field: 'enrollmentId',
        message: 'Enrollment identifier is required.',
      });
    }

    if (!props.learningUnitId || props.learningUnitId.trim().length === 0) {
      issues.push({
        field: 'learningUnitId',
        message: 'LearningUnit identifier is required.',
      });
    }

    try {
      this.validatePercentage(props.percentage);
    } catch (error) {
      if (error instanceof LessonProgressValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    if (props.startedAt !== null && !isValidDate(props.startedAt)) {
      issues.push({
        field: 'startedAt',
        message: 'LessonProgress start timestamp must be a valid Date or null.',
      });
    }

    if (props.completedAt !== null && !isValidDate(props.completedAt)) {
      issues.push({
        field: 'completedAt',
        message:
          'LessonProgress completion timestamp must be a valid Date or null.',
      });
    }

    if (!isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'LessonProgress creation timestamp must be valid.',
      });
    }

    if (!isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'LessonProgress update timestamp must be valid.',
      });
    }

    if (
      isValidDate(props.createdAt) &&
      isValidDate(props.updatedAt) &&
      props.updatedAt.getTime() < props.createdAt.getTime()
    ) {
      issues.push({
        field: 'updatedAt',
        message:
          'LessonProgress update timestamp cannot precede creation time.',
      });
    }

    if (
      props.startedAt !== null &&
      isValidDate(props.startedAt) &&
      isValidDate(props.createdAt) &&
      props.startedAt.getTime() < props.createdAt.getTime()
    ) {
      issues.push({
        field: 'startedAt',
        message: 'LessonProgress start timestamp cannot precede creation time.',
      });
    }

    if (
      props.completedAt !== null &&
      isValidDate(props.completedAt) &&
      props.startedAt !== null &&
      isValidDate(props.startedAt) &&
      props.completedAt.getTime() < props.startedAt.getTime()
    ) {
      issues.push({
        field: 'completedAt',
        message:
          'LessonProgress completion timestamp cannot precede start time.',
      });
    }

    if (
      props.status === LessonProgressStatus.NOT_STARTED &&
      (props.startedAt !== null ||
        props.completedAt !== null ||
        props.percentage !== MIN_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'NOT_STARTED LessonProgress must have 0% progress and no lifecycle timestamps.',
      });
    }

    if (
      props.status === LessonProgressStatus.IN_PROGRESS &&
      (props.startedAt === null || props.completedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'IN_PROGRESS LessonProgress requires startedAt and must not have completedAt.',
      });
    }

    if (
      props.status === LessonProgressStatus.COMPLETED &&
      (props.startedAt === null ||
        props.completedAt === null ||
        props.percentage !== MAX_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'COMPLETED LessonProgress requires startedAt, completedAt and 100% progress.',
      });
    }

    if (issues.length > 0) {
      throw new LessonProgressValidationError(
        'Invalid LessonProgress state.',
        issues,
      );
    }
  }
}

type LessonProgressValidationIssue = {
  readonly field: string;
  readonly message: string;
};

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
