import { randomUUID } from 'node:crypto';

import {
  InvalidLearningSessionTransitionError,
  LearningSessionValidationError,
} from './learning-session-error.js';

import {
  createLearningSessionAbandonedEvent,
  createLearningSessionCompletedEvent,
  createLearningSessionPausedEvent,
  createLearningSessionResumedEvent,
  createLearningSessionStartedEvent,
  type LearningSessionEvent,
  type LearningSessionLifecyclePayload,
} from './learning-session-events.js';

import {
  LearningSessionStatus,
  type LearningSessionStatus as LearningSessionStatusValue,
} from './learning-session-status.js';

export interface LearningSessionProps {
  readonly id: string;
  readonly enrollmentId: string;
  readonly status: LearningSessionStatusValue;
  readonly startedAt: Date;
  readonly pausedAt: Date | null;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateLearningSessionProps {
  readonly enrollmentId: string;
  readonly now?: Date;
}

type MutableLearningSessionProps = {
  -readonly [K in keyof LearningSessionProps]: LearningSessionProps[K];
};

const TERMINAL_STATUSES = new Set<LearningSessionStatusValue>([
  LearningSessionStatus.COMPLETED,
  LearningSessionStatus.ABANDONED,
]);

export class LearningSession {
  private readonly props: MutableLearningSessionProps;

  private readonly domainEvents: LearningSessionEvent[] = [];

  private constructor(props: LearningSessionProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      startedAt: new Date(props.startedAt),
      pausedAt: props.pausedAt === null ? null : new Date(props.pausedAt),
      endedAt: props.endedAt === null ? null : new Date(props.endedAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  /**
   * A LearningSession is created already ACTIVE.
   *
   * Authorization/access eligibility is intentionally not evaluated here.
   * The application service must validate the Enrollment + Entitlement
   * boundary before creating the aggregate.
   */
  static create(input: CreateLearningSessionProps): LearningSession {
    const now = input.now ? new Date(input.now) : new Date();

    if (!isValidDate(now)) {
      throw new LearningSessionValidationError(
        'Invalid LearningSession creation time.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    const session = new LearningSession({
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      status: LearningSessionStatus.ACTIVE,
      startedAt: now,
      pausedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    session.domainEvents.push(
      createLearningSessionStartedEvent(
        session.id,
        {
          sessionId: session.id,
          enrollmentId: session.enrollmentId,
          status: session.status,
          startedAt: session.startedAt,
        },
        now,
      ),
    );

    return session;
  }

  static rehydrate(props: LearningSessionProps): LearningSession {
    return new LearningSession(props);
  }

  get id(): string {
    return this.props.id;
  }

  get enrollmentId(): string {
    return this.props.enrollmentId;
  }

  get status(): LearningSessionStatusValue {
    return this.props.status;
  }

  get startedAt(): Date {
    return new Date(this.props.startedAt);
  }

  get pausedAt(): Date | null {
    return this.props.pausedAt === null ? null : new Date(this.props.pausedAt);
  }

  get endedAt(): Date | null {
    return this.props.endedAt === null ? null : new Date(this.props.endedAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  pause(now: Date = new Date()): void {
    this.transition(
      LearningSessionStatus.ACTIVE,
      LearningSessionStatus.PAUSED,
      now,
      (occurredAt, previousStatus) => {
        this.props.pausedAt = new Date(occurredAt);

        return createLearningSessionPausedEvent(
          this.id,
          this.lifecyclePayload(previousStatus, LearningSessionStatus.PAUSED),
          occurredAt,
        );
      },
    );
  }

  resume(now: Date = new Date()): void {
    this.transition(
      LearningSessionStatus.PAUSED,
      LearningSessionStatus.ACTIVE,
      now,
      (occurredAt, previousStatus) => {
        this.props.pausedAt = null;

        return createLearningSessionResumedEvent(
          this.id,
          this.lifecyclePayload(previousStatus, LearningSessionStatus.ACTIVE),
          occurredAt,
        );
      },
    );
  }

  complete(now: Date = new Date()): void {
    this.end(
      LearningSessionStatus.COMPLETED,
      now,
      (occurredAt, previousStatus) =>
        createLearningSessionCompletedEvent(
          this.id,
          this.lifecyclePayload(
            previousStatus,
            LearningSessionStatus.COMPLETED,
          ),
          occurredAt,
        ),
    );
  }

  abandon(now: Date = new Date()): void {
    this.end(
      LearningSessionStatus.ABANDONED,
      now,
      (occurredAt, previousStatus) =>
        createLearningSessionAbandonedEvent(
          this.id,
          this.lifecyclePayload(
            previousStatus,
            LearningSessionStatus.ABANDONED,
          ),
          occurredAt,
        ),
    );
  }

  getDomainEvents(): readonly LearningSessionEvent[] {
    return structuredClone(this.domainEvents);
  }

  pullDomainEvents(): LearningSessionEvent[] {
    const events = structuredClone(this.domainEvents);

    this.domainEvents.length = 0;

    return events;
  }

  toPrimitives(): LearningSessionProps {
    return {
      id: this.id,
      enrollmentId: this.enrollmentId,
      status: this.status,
      startedAt: this.startedAt,
      pausedAt: this.pausedAt,
      endedAt: this.endedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private transition(
    expected: LearningSessionStatusValue,
    next: LearningSessionStatusValue,
    now: Date,
    createEvent: (
      occurredAt: Date,
      previousStatus: LearningSessionStatusValue,
    ) => LearningSessionEvent,
  ): void {
    if (this.status !== expected) {
      throw new InvalidLearningSessionTransitionError(
        `Cannot transition LearningSession from ${this.status} to ${next}.`,
        [
          {
            field: 'status',
            message: `Expected ${expected}, received ${this.status}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);
    const previousStatus = this.status;

    this.props.status = next;
    this.props.updatedAt = new Date(occurredAt);

    this.domainEvents.push(createEvent(occurredAt, previousStatus));
  }

  private end(
    next:
      | typeof LearningSessionStatus.COMPLETED
      | typeof LearningSessionStatus.ABANDONED,
    now: Date,
    createEvent: (
      occurredAt: Date,
      previousStatus: LearningSessionStatusValue,
    ) => LearningSessionEvent,
  ): void {
    if (
      this.status !== LearningSessionStatus.ACTIVE &&
      this.status !== LearningSessionStatus.PAUSED
    ) {
      throw new InvalidLearningSessionTransitionError(
        `Cannot transition LearningSession from ${this.status} to ${next}.`,
        [
          {
            field: 'status',
            message: `Expected ACTIVE or PAUSED, received ${this.status}.`,
          },
        ],
      );
    }

    const occurredAt = this.validateTransitionDate(now);
    const previousStatus = this.status;

    this.props.status = next;
    this.props.endedAt = new Date(occurredAt);
    this.props.pausedAt = null;
    this.props.updatedAt = new Date(occurredAt);

    this.domainEvents.push(createEvent(occurredAt, previousStatus));
  }

  private lifecyclePayload(
    previousStatus: LearningSessionStatusValue,
    currentStatus: LearningSessionStatusValue,
  ): LearningSessionLifecyclePayload {
    return {
      sessionId: this.id,
      enrollmentId: this.enrollmentId,
      previousStatus,
      currentStatus,
    };
  }

  private validateTransitionDate(now: Date): Date {
    const value = new Date(now);

    if (!isValidDate(value)) {
      throw new LearningSessionValidationError(
        'LearningSession transition time is invalid.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    if (value.getTime() < this.props.createdAt.getTime()) {
      throw new LearningSessionValidationError(
        'LearningSession transition time cannot precede creation time.',
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

  private validateProps(props: LearningSessionProps): void {
    const issues: LearningSessionValidationIssue[] = [];

    if (!props.id || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'LearningSession identifier is required.',
      });
    }

    if (!props.enrollmentId || props.enrollmentId.trim().length === 0) {
      issues.push({
        field: 'enrollmentId',
        message: 'Enrollment identifier is required.',
      });
    }

    if (!isValidDate(props.startedAt)) {
      issues.push({
        field: 'startedAt',
        message: 'Session start timestamp must be a valid Date.',
      });
    }

    if (props.pausedAt !== null && !isValidDate(props.pausedAt)) {
      issues.push({
        field: 'pausedAt',
        message: 'Session pause timestamp must be a valid Date or null.',
      });
    }

    if (props.endedAt !== null && !isValidDate(props.endedAt)) {
      issues.push({
        field: 'endedAt',
        message: 'Session end timestamp must be a valid Date or null.',
      });
    }

    if (
      isValidDate(props.startedAt) &&
      props.pausedAt !== null &&
      isValidDate(props.pausedAt) &&
      props.pausedAt.getTime() < props.startedAt.getTime()
    ) {
      issues.push({
        field: 'pausedAt',
        message: 'Session pause timestamp cannot precede session start.',
      });
    }

    if (
      isValidDate(props.startedAt) &&
      props.endedAt !== null &&
      isValidDate(props.endedAt) &&
      props.endedAt.getTime() < props.startedAt.getTime()
    ) {
      issues.push({
        field: 'endedAt',
        message: 'Session end timestamp cannot precede session start.',
      });
    }

    if (
      props.status === LearningSessionStatus.ACTIVE &&
      (props.endedAt !== null || props.pausedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'ACTIVE LearningSession must not have an end or active pause timestamp.',
      });
    }

    if (
      props.status === LearningSessionStatus.PAUSED &&
      (props.pausedAt === null || props.endedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'PAUSED LearningSession requires pausedAt and must not have endedAt.',
      });
    }

    if (
      TERMINAL_STATUSES.has(props.status) &&
      (props.endedAt === null || props.pausedAt !== null)
    ) {
      issues.push({
        field: 'status',
        message:
          'Terminal LearningSession requires endedAt and must not have pausedAt.',
      });
    }

    if (!isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Creation timestamp must be valid.',
      });
    }

    if (!isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Update timestamp must be valid.',
      });
    }

    if (
      isValidDate(props.createdAt) &&
      isValidDate(props.startedAt) &&
      props.startedAt.getTime() < props.createdAt.getTime()
    ) {
      issues.push({
        field: 'startedAt',
        message: 'Session start cannot precede creation time.',
      });
    }

    if (
      isValidDate(props.createdAt) &&
      isValidDate(props.updatedAt) &&
      props.updatedAt.getTime() < props.createdAt.getTime()
    ) {
      issues.push({
        field: 'updatedAt',
        message: 'Update timestamp cannot precede creation time.',
      });
    }

    if (issues.length > 0) {
      throw new LearningSessionValidationError(
        'Invalid LearningSession state.',
        issues,
      );
    }
  }
}

type LearningSessionValidationIssue = {
  readonly field: string;
  readonly message: string;
};

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
