import { randomUUID } from 'node:crypto';

import {
  InvalidProgressTransitionError,
  ProgressValidationError,
} from './progress-error.js';

import {
  createProgressCompletedEvent,
  createProgressStartedEvent,
  createProgressUpdatedEvent,
  type ProgressCompletedEvent,
  type ProgressEvent,
  type ProgressStartedEvent,
  type ProgressUpdatedEvent,
} from './progress-events.js';

import {
  ProgressStatus,
  type ProgressStatus as ProgressStatusValue,
} from './progress-status.js';

export interface ProgressProps {
  readonly id: string;
  readonly enrollmentId: string;
  readonly status: ProgressStatusValue;
  readonly percentage: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProgressProps {
  readonly enrollmentId: string;
  readonly now?: Date;
}

type MutableProgressProps = {
  -readonly [K in keyof ProgressProps]: ProgressProps[K];
};

const MAX_PERCENTAGE = 100;
const MIN_PERCENTAGE = 0;

export class Progress {
  private readonly props: MutableProgressProps;

  private readonly domainEvents: ProgressEvent[] = [];

  private constructor(props: ProgressProps) {
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
   * Creates an empty progress aggregate.
   *
   * Creation itself does not mean that learning has started.
   *
   * The first actual learning transition is represented by
   * ProgressStarted.
   */
  static create(input: CreateProgressProps): Progress {
    const now = input.now === undefined ? new Date() : new Date(input.now);

    if (!isValidDate(now)) {
      throw new ProgressValidationError('Invalid Progress creation time.', [
        {
          field: 'now',
          message: 'Expected a valid Date.',
        },
      ]);
    }

    return new Progress({
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      status: ProgressStatus.NOT_STARTED,
      percentage: MIN_PERCENTAGE,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rehydrates Progress from persisted state.
   *
   * Rehydration never creates domain events.
   */
  static rehydrate(props: ProgressProps): Progress {
    return new Progress(props);
  }

  get id(): string {
    return this.props.id;
  }

  get enrollmentId(): string {
    return this.props.enrollmentId;
  }

  get status(): ProgressStatusValue {
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
   * Marks the beginning of learner progress.
   *
   * NOT_STARTED -> IN_PROGRESS
   */
  start(now: Date = new Date()): void {
    if (this.status !== ProgressStatus.NOT_STARTED) {
      throw new InvalidProgressTransitionError(
        `Cannot start Progress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${ProgressStatus.NOT_STARTED}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);

    this.props.status = ProgressStatus.IN_PROGRESS;
    this.props.startedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: ProgressStartedEvent = createProgressStartedEvent(
      this.id,
      {
        progressId: this.id,
        enrollmentId: this.enrollmentId,
        status: this.status,
        percentage: this.percentage,
        startedAt: this.startedAt as Date,
      },
      occurredAt,
    );

    this.domainEvents.push(event);
  }

  /**
   * Updates the deterministic progress percentage.
   *
   * Percentage is deliberately kept independent from completion.
   * A value of 100 does not automatically complete the aggregate.
   *
   * Completion remains an explicit domain transition because later
   * Completion Rules may impose requirements beyond percentage.
   */
  updatePercentage(percentage: number, now: Date = new Date()): void {
    this.validatePercentage(percentage);

    if (this.status === ProgressStatus.NOT_STARTED) {
      throw new InvalidProgressTransitionError(
        'Progress must be started before its percentage can be updated.',
        [
          {
            field: 'status',
            message:
              `Expected ${ProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.status === ProgressStatus.COMPLETED) {
      throw new InvalidProgressTransitionError(
        'Completed Progress cannot be modified.',
        [
          {
            field: 'status',
            message: 'Completed Progress is terminal and cannot be updated.',
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

    const event: ProgressUpdatedEvent = createProgressUpdatedEvent(
      this.id,
      {
        progressId: this.id,
        enrollmentId: this.enrollmentId,
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
   * Explicitly completes Progress.
   *
   * Completion requires 100% progress.
   *
   * This keeps percentage and completion semantically distinct while
   * preventing a completed aggregate from representing incomplete
   * progress.
   */
  complete(now: Date = new Date()): void {
    if (this.status !== ProgressStatus.IN_PROGRESS) {
      throw new InvalidProgressTransitionError(
        `Cannot complete Progress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${ProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.percentage !== MAX_PERCENTAGE) {
      throw new InvalidProgressTransitionError(
        'Progress cannot be completed before reaching 100%.',
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

    this.props.status = ProgressStatus.COMPLETED;
    this.props.completedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: ProgressCompletedEvent = createProgressCompletedEvent(
      this.id,
      {
        progressId: this.id,
        enrollmentId: this.enrollmentId,
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
   * Returns an immutable snapshot of pending domain events.
   *
   * The aggregate remains responsible for draining the events only
   * after successful transactional persistence.
   */
  getDomainEvents(): readonly ProgressEvent[] {
    return structuredClone(this.domainEvents);
  }

  /**
   * Drains pending domain events.
   *
   * Infrastructure must call this only after the complete aggregate
   * + Outbox transaction has committed successfully.
   */
  pullDomainEvents(): ProgressEvent[] {
    const events = structuredClone(this.domainEvents);

    this.domainEvents.length = 0;

    return events;
  }

  /**
   * Returns a detached persistence-safe representation.
   */
  toPrimitives(): ProgressProps {
    return {
      id: this.id,
      enrollmentId: this.enrollmentId,
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
      throw new ProgressValidationError(
        'Progress transition time is invalid.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    if (value.getTime() < this.props.createdAt.getTime()) {
      throw new ProgressValidationError(
        'Progress transition time cannot precede creation time.',
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
      !Number.isFinite(percentage) ||
      percentage < MIN_PERCENTAGE ||
      percentage > MAX_PERCENTAGE
    ) {
      throw new ProgressValidationError('Progress percentage is invalid.', [
        {
          field: 'percentage',
          message:
            `Percentage must be a finite number between ` +
            `${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}.`,
        },
      ]);
    }
  }

  private validateProps(props: ProgressProps): void {
    const issues: ProgressValidationIssue[] = [];

    if (!props.id || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'Progress identifier is required.',
      });
    }

    if (!props.enrollmentId || props.enrollmentId.trim().length === 0) {
      issues.push({
        field: 'enrollmentId',
        message: 'Enrollment identifier is required.',
      });
    }

    try {
      this.validatePercentage(props.percentage);
    } catch (error) {
      if (error instanceof ProgressValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    if (props.startedAt !== null && !isValidDate(props.startedAt)) {
      issues.push({
        field: 'startedAt',
        message: 'Progress start timestamp must be a valid Date or null.',
      });
    }

    if (props.completedAt !== null && !isValidDate(props.completedAt)) {
      issues.push({
        field: 'completedAt',
        message: 'Progress completion timestamp must be a valid Date or null.',
      });
    }

    if (!isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Progress creation timestamp must be valid.',
      });
    }

    if (!isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Progress update timestamp must be valid.',
      });
    }

    if (
      isValidDate(props.createdAt) &&
      isValidDate(props.updatedAt) &&
      props.updatedAt.getTime() < props.createdAt.getTime()
    ) {
      issues.push({
        field: 'updatedAt',
        message: 'Progress update timestamp cannot precede creation time.',
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
        message: 'Progress start timestamp cannot precede creation time.',
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
        message: 'Progress completion timestamp cannot precede start time.',
      });
    }

    if (
      props.status === ProgressStatus.NOT_STARTED &&
      (props.startedAt !== null ||
        props.completedAt !== null ||
        props.percentage !== MIN_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'NOT_STARTED Progress must have 0% progress and no lifecycle timestamps.',
      });
    }

    if (
      props.status === ProgressStatus.IN_PROGRESS &&
      (props.startedAt === null || props.completedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'IN_PROGRESS Progress requires startedAt and must not have completedAt.',
      });
    }

    if (
      props.status === ProgressStatus.COMPLETED &&
      (props.startedAt === null ||
        props.completedAt === null ||
        props.percentage !== MAX_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'COMPLETED Progress requires startedAt, completedAt and 100% progress.',
      });
    }

    if (issues.length > 0) {
      throw new ProgressValidationError('Invalid Progress state.', issues);
    }
  }
}

type ProgressValidationIssue = {
  readonly field: string;
  readonly message: string;
};

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
