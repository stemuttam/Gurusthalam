import { randomUUID } from 'node:crypto';

import {
  InvalidSectionProgressTransitionError,
  SectionProgressValidationError,
} from './section-progress-error.js';

import {
  createSectionProgressCompletedEvent,
  createSectionProgressStartedEvent,
  createSectionProgressUpdatedEvent,
  type SectionProgressCompletedEvent,
  type SectionProgressEvent,
  type SectionProgressStartedEvent,
  type SectionProgressUpdatedEvent,
} from './section-progress-events.js';

import {
  isSectionProgressStatus,
  SectionProgressStatus,
  type SectionProgressStatus as SectionProgressStatusValue,
} from './section-progress-status.js';

export interface SectionProgressProps {
  readonly id: string;
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly status: SectionProgressStatusValue;
  readonly percentage: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSectionProgressProps {
  readonly enrollmentId: string;
  readonly sectionId: string;
  readonly now?: Date;
}

type MutableSectionProgressProps = {
  -readonly [K in keyof SectionProgressProps]: SectionProgressProps[K];
};

const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;

export class SectionProgress {
  private readonly props: MutableSectionProgressProps;

  private readonly domainEvents: SectionProgressEvent[] = [];

  private constructor(props: SectionProgressProps) {
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

  static create(input: CreateSectionProgressProps): SectionProgress {
    const now = input.now === undefined ? new Date() : new Date(input.now);

    if (!isValidDate(now)) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress creation time.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    return new SectionProgress({
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      sectionId: input.sectionId,
      status: SectionProgressStatus.NOT_STARTED,
      percentage: MIN_PERCENTAGE,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: SectionProgressProps): SectionProgress {
    return new SectionProgress(props);
  }

  get id(): string {
    return this.props.id;
  }

  get enrollmentId(): string {
    return this.props.enrollmentId;
  }

  get sectionId(): string {
    return this.props.sectionId;
  }

  get status(): SectionProgressStatusValue {
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
   * NOT_STARTED -> IN_PROGRESS
   */
  start(now: Date = new Date()): void {
    if (this.status !== SectionProgressStatus.NOT_STARTED) {
      throw new InvalidSectionProgressTransitionError(
        `Cannot start SectionProgress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${SectionProgressStatus.NOT_STARTED}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);

    this.props.status = SectionProgressStatus.IN_PROGRESS;
    this.props.startedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: SectionProgressStartedEvent =
      createSectionProgressStartedEvent(
        this.id,
        {
          sectionProgressId: this.id,
          enrollmentId: this.enrollmentId,
          sectionId: this.sectionId,
          status: this.status,
          percentage: this.percentage,
          startedAt: this.startedAt as Date,
        },
        occurredAt,
      );

    this.domainEvents.push(event);
  }

  /**
   * Updates deterministic section progress.
   *
   * Reaching 100% does not implicitly complete the aggregate.
   */
  updatePercentage(percentage: number, now: Date = new Date()): void {
    this.validatePercentage(percentage);

    if (this.status === SectionProgressStatus.NOT_STARTED) {
      throw new InvalidSectionProgressTransitionError(
        'SectionProgress must be started before its percentage can be updated.',
        [
          {
            field: 'status',
            message:
              `Expected ${SectionProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.status === SectionProgressStatus.COMPLETED) {
      throw new InvalidSectionProgressTransitionError(
        'Completed SectionProgress cannot be modified.',
        [
          {
            field: 'status',
            message:
              'Completed SectionProgress is terminal and cannot be updated.',
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

    const event: SectionProgressUpdatedEvent =
      createSectionProgressUpdatedEvent(
        this.id,
        {
          sectionProgressId: this.id,
          enrollmentId: this.enrollmentId,
          sectionId: this.sectionId,
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
   * IN_PROGRESS -> COMPLETED.
   *
   * Completion requires exactly 100%.
   */
  complete(now: Date = new Date()): void {
    if (this.status !== SectionProgressStatus.IN_PROGRESS) {
      throw new InvalidSectionProgressTransitionError(
        `Cannot complete SectionProgress from status ${this.status}.`,
        [
          {
            field: 'status',
            message:
              `Expected ${SectionProgressStatus.IN_PROGRESS}, ` +
              `received ${this.status}.`,
          },
        ],
      );
    }

    if (this.percentage !== MAX_PERCENTAGE) {
      throw new InvalidSectionProgressTransitionError(
        'SectionProgress cannot be completed before reaching 100%.',
        [
          {
            field: 'percentage',
            message: `Expected ${MAX_PERCENTAGE}, received ${this.percentage}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);

    const previousStatus = this.status;

    this.props.status = SectionProgressStatus.COMPLETED;
    this.props.completedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    const event: SectionProgressCompletedEvent =
      createSectionProgressCompletedEvent(
        this.id,
        {
          sectionProgressId: this.id,
          enrollmentId: this.enrollmentId,
          sectionId: this.sectionId,
          previousStatus,
          currentStatus: this.status,
          percentage: this.percentage,
          completedAt: this.completedAt as Date,
        },
        occurredAt,
      );

    this.domainEvents.push(event);
  }

  getDomainEvents(): readonly SectionProgressEvent[] {
    return structuredClone(this.domainEvents);
  }

  pullDomainEvents(): SectionProgressEvent[] {
    const events = structuredClone(this.domainEvents);

    this.domainEvents.length = 0;

    return events;
  }

  toPrimitives(): SectionProgressProps {
    return {
      id: this.id,
      enrollmentId: this.enrollmentId,
      sectionId: this.sectionId,
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
      throw new SectionProgressValidationError(
        'SectionProgress transition time is invalid.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    if (value.getTime() < this.props.createdAt.getTime()) {
      throw new SectionProgressValidationError(
        'SectionProgress transition time cannot precede creation time.',
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
      !Number.isInteger(percentage) ||
      percentage < MIN_PERCENTAGE ||
      percentage > MAX_PERCENTAGE
    ) {
      throw new SectionProgressValidationError(
        'SectionProgress percentage is invalid.',
        [
          {
            field: 'percentage',
            message:
              `Percentage must be a finite integer between ` +
              `${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}.`,
          },
        ],
      );
    }
  }

  private validateProps(props: SectionProgressProps): void {
    const issues: SectionProgressValidationIssue[] = [];

    if (!props.id || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'SectionProgress identifier is required.',
      });
    }

    if (!props.enrollmentId || props.enrollmentId.trim().length === 0) {
      issues.push({
        field: 'enrollmentId',
        message: 'Enrollment identifier is required.',
      });
    }

    if (!props.sectionId || props.sectionId.trim().length === 0) {
      issues.push({
        field: 'sectionId',
        message: 'Section identifier is required.',
      });
    }

    if (!isSectionProgressStatus(props.status)) {
      issues.push({
        field: 'status',
        message: 'SectionProgress status is invalid.',
      });
    }

    try {
      this.validatePercentage(props.percentage);
    } catch (error) {
      if (error instanceof SectionProgressValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }

    if (props.startedAt !== null && !isValidDate(props.startedAt)) {
      issues.push({
        field: 'startedAt',
        message: 'SectionProgress start timestamp must be valid or null.',
      });
    }

    if (props.completedAt !== null && !isValidDate(props.completedAt)) {
      issues.push({
        field: 'completedAt',
        message: 'SectionProgress completion timestamp must be valid or null.',
      });
    }

    if (!isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'SectionProgress creation timestamp must be valid.',
      });
    }

    if (!isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'SectionProgress update timestamp must be valid.',
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
          'SectionProgress update timestamp cannot precede creation time.',
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
        message:
          'SectionProgress start timestamp cannot precede creation time.',
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
          'SectionProgress completion timestamp cannot precede start time.',
      });
    }

    if (
      props.status === SectionProgressStatus.NOT_STARTED &&
      (props.startedAt !== null ||
        props.completedAt !== null ||
        props.percentage !== MIN_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'NOT_STARTED SectionProgress must have 0% progress and no lifecycle timestamps.',
      });
    }

    if (
      props.status === SectionProgressStatus.IN_PROGRESS &&
      (props.startedAt === null || props.completedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'IN_PROGRESS SectionProgress requires startedAt and no completedAt.',
      });
    }

    if (
      props.status === SectionProgressStatus.COMPLETED &&
      (props.startedAt === null ||
        props.completedAt === null ||
        props.percentage !== MAX_PERCENTAGE)
    ) {
      issues.push({
        field: 'status',
        message:
          'COMPLETED SectionProgress requires startedAt, completedAt and 100%.',
      });
    }

    if (issues.length > 0) {
      throw new SectionProgressValidationError(
        'Invalid SectionProgress state.',
        issues,
      );
    }
  }
}

type SectionProgressValidationIssue = {
  readonly field: string;
  readonly message: string;
};

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
