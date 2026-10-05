import { randomUUID } from 'node:crypto';

import {
  EnrollmentValidationError,
  InvalidEnrollmentTransitionError,
} from './enrollment-error.js';

import {
  createEnrollmentActivatedEvent,
  createEnrollmentCancelledEvent,
  createEnrollmentCompletedEvent,
  createEnrollmentCreatedEvent,
  createEnrollmentExpiredEvent,
  type EnrollmentEvent,
  EnrollmentDomainEventName,
  type EnrollmentLifecyclePayload,
} from './enrollment-events.js';

import type { EnrollmentSource } from './enrollment-source.js';

import {
  EnrollmentStatus,
  type EnrollmentStatus as EnrollmentStatusValue,
} from './enrollment-status.js';

export interface EnrollmentProps {
  readonly id: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly status: EnrollmentStatusValue;
  readonly source: EnrollmentSource;
  readonly startsAt: Date;
  readonly expiresAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateEnrollmentProps {
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly source: EnrollmentSource;
  readonly startsAt?: Date;
  readonly expiresAt?: Date | null;
  readonly now?: Date;
}

type MutableEnrollmentProps = {
  -readonly [K in keyof EnrollmentProps]: EnrollmentProps[K];
};

const TERMINAL_STATUSES = new Set<EnrollmentStatusValue>([
  EnrollmentStatus.COMPLETED,
  EnrollmentStatus.CANCELLED,
  EnrollmentStatus.EXPIRED,
]);

export class Enrollment {
  private readonly props: MutableEnrollmentProps;

  private readonly domainEvents: EnrollmentEvent[] = [];

  private constructor(props: EnrollmentProps) {
    this.validateProps(props);

    this.props = {
      ...props,

      createdAt: new Date(props.createdAt),

      updatedAt: new Date(props.updatedAt),

      startsAt: new Date(props.startsAt),

      expiresAt: props.expiresAt === null ? null : new Date(props.expiresAt),

      completedAt:
        props.completedAt === null ? null : new Date(props.completedAt),

      cancelledAt:
        props.cancelledAt === null ? null : new Date(props.cancelledAt),
    };
  }

  static create(input: CreateEnrollmentProps): Enrollment {
    const now = input.now ? new Date(input.now) : new Date();

    const startsAt =
      input.startsAt !== undefined ? new Date(input.startsAt) : new Date(now);

    const status =
      startsAt.getTime() > now.getTime()
        ? EnrollmentStatus.PENDING
        : EnrollmentStatus.ACTIVE;

    const enrollment = new Enrollment({
      id: randomUUID(),
      learnerId: input.learnerId,
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      status,
      source: input.source,
      startsAt,
      expiresAt:
        input.expiresAt === undefined || input.expiresAt === null
          ? null
          : new Date(input.expiresAt),
      completedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });

    enrollment.domainEvents.push(
      createEnrollmentCreatedEvent(
        enrollment.id,
        {
          enrollmentId: enrollment.id,
          learnerId: enrollment.learnerId,
          courseId: enrollment.courseId,
          courseVersionId: enrollment.courseVersionId,
          status: enrollment.status,
          source: enrollment.source,
          startsAt: enrollment.startsAt,
          expiresAt: enrollment.expiresAt,
        },
        now,
      ),
    );

    return enrollment;
  }

  static rehydrate(props: EnrollmentProps): Enrollment {
    return new Enrollment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get learnerId(): string {
    return this.props.learnerId;
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get courseVersionId(): string {
    return this.props.courseVersionId;
  }

  get status(): EnrollmentStatusValue {
    return this.props.status;
  }

  get source(): EnrollmentSource {
    return this.props.source;
  }

  get startsAt(): Date {
    return new Date(this.props.startsAt);
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt === null
      ? null
      : new Date(this.props.expiresAt);
  }

  get completedAt(): Date | null {
    return this.props.completedAt === null
      ? null
      : new Date(this.props.completedAt);
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt === null
      ? null
      : new Date(this.props.cancelledAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  isActive(): boolean {
    return (
      this.status === EnrollmentStatus.ACTIVE ||
      this.status === EnrollmentStatus.PENDING
    );
  }

  getDomainEvents(): readonly EnrollmentEvent[] {
    return structuredClone(this.domainEvents);
  }

  pullDomainEvents(): readonly EnrollmentEvent[] {
    const events = this.getDomainEvents();

    this.domainEvents.length = 0;

    return events;
  }

  activate(now = new Date()): void {
    if (this.status === EnrollmentStatus.ACTIVE) {
      return;
    }

    if (this.status !== EnrollmentStatus.PENDING) {
      throw new InvalidEnrollmentTransitionError(
        'Enrollment cannot be activated from its current state.',
        [
          {
            field: 'status',
            message: `Cannot activate an Enrollment in ${this.status} status.`,
          },
        ],
      );
    }

    if (this.expiresAt !== null && this.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidEnrollmentTransitionError(
        'Expired enrollment cannot be activated.',
        [
          {
            field: 'expiresAt',
            message:
              'An enrollment whose expiration timestamp has passed cannot be activated.',
          },
        ],
      );
    }

    const previousStatus = this.status;

    this.props.status = EnrollmentStatus.ACTIVE;

    this.props.updatedAt = new Date(now);

    this.recordLifecycleEvent(
      EnrollmentDomainEventName.ACTIVATED,
      previousStatus,
      this.props.status,
      now,
    );
  }

  complete(now = new Date()): void {
    if (this.status !== EnrollmentStatus.ACTIVE) {
      throw new InvalidEnrollmentTransitionError(
        'Only an active Enrollment can be completed.',
        [
          {
            field: 'status',
            message: `Cannot complete an Enrollment in ${this.status} status.`,
          },
        ],
      );
    }

    const previousStatus = this.status;

    this.props.status = EnrollmentStatus.COMPLETED;

    this.props.completedAt = new Date(now);

    this.props.updatedAt = new Date(now);

    this.recordLifecycleEvent(
      EnrollmentDomainEventName.COMPLETED,
      previousStatus,
      this.props.status,
      now,
    );
  }

  cancel(now = new Date()): void {
    if (TERMINAL_STATUSES.has(this.status)) {
      throw new InvalidEnrollmentTransitionError(
        'Terminal Enrollment cannot be cancelled.',
        [
          {
            field: 'status',
            message: `Cannot cancel an Enrollment in ${this.status} status.`,
          },
        ],
      );
    }

    const previousStatus = this.status;

    this.props.status = EnrollmentStatus.CANCELLED;

    this.props.cancelledAt = new Date(now);

    this.props.updatedAt = new Date(now);

    this.recordLifecycleEvent(
      EnrollmentDomainEventName.CANCELLED,
      previousStatus,
      this.props.status,
      now,
    );
  }

  expire(now = new Date()): void {
    if (
      this.status !== EnrollmentStatus.PENDING &&
      this.status !== EnrollmentStatus.ACTIVE
    ) {
      throw new InvalidEnrollmentTransitionError(
        'Only pending or active Enrollment can expire.',
        [
          {
            field: 'status',
            message: `Cannot expire an Enrollment in ${this.status} status.`,
          },
        ],
      );
    }

    const previousStatus = this.status;

    this.props.status = EnrollmentStatus.EXPIRED;

    this.props.updatedAt = new Date(now);

    this.recordLifecycleEvent(
      EnrollmentDomainEventName.EXPIRED,
      previousStatus,
      this.props.status,
      now,
    );
  }

  toPrimitives(): EnrollmentProps {
    return {
      id: this.id,
      learnerId: this.learnerId,
      courseId: this.courseId,
      courseVersionId: this.courseVersionId,
      status: this.status,
      source: this.source,
      startsAt: this.startsAt,
      expiresAt: this.expiresAt,
      completedAt: this.completedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private recordLifecycleEvent(
    eventName:
      | typeof EnrollmentDomainEventName.ACTIVATED
      | typeof EnrollmentDomainEventName.CANCELLED
      | typeof EnrollmentDomainEventName.EXPIRED
      | typeof EnrollmentDomainEventName.COMPLETED,
    previousStatus: EnrollmentStatusValue,
    currentStatus: EnrollmentStatusValue,
    occurredAt: Date,
  ): void {
    const payload: EnrollmentLifecyclePayload = {
      enrollmentId: this.id,
      learnerId: this.learnerId,
      courseId: this.courseId,
      courseVersionId: this.courseVersionId,
      previousStatus,
      currentStatus,
    };

    switch (eventName) {
      case EnrollmentDomainEventName.ACTIVATED:
        this.domainEvents.push(
          createEnrollmentActivatedEvent(this.id, payload, occurredAt),
        );
        return;

      case EnrollmentDomainEventName.CANCELLED:
        this.domainEvents.push(
          createEnrollmentCancelledEvent(this.id, payload, occurredAt),
        );
        return;

      case EnrollmentDomainEventName.EXPIRED:
        this.domainEvents.push(
          createEnrollmentExpiredEvent(this.id, payload, occurredAt),
        );
        return;

      case EnrollmentDomainEventName.COMPLETED:
        this.domainEvents.push(
          createEnrollmentCompletedEvent(this.id, payload, occurredAt),
        );
        return;
    }
  }

  private validateProps(props: EnrollmentProps): void {
    const issues: Array<{
      field: string;
      message: string;
    }> = [];

    if (!props.id || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'Enrollment identifier is required.',
      });
    }

    if (!props.learnerId || props.learnerId.trim().length === 0) {
      issues.push({
        field: 'learnerId',
        message: 'Learner identifier is required.',
      });
    }

    if (!props.courseId || props.courseId.trim().length === 0) {
      issues.push({
        field: 'courseId',
        message: 'Course identifier is required.',
      });
    }

    if (!props.courseVersionId || props.courseVersionId.trim().length === 0) {
      issues.push({
        field: 'courseVersionId',
        message: 'CourseVersion identifier is required.',
      });
    }

    if (!this.isValidDate(props.startsAt)) {
      issues.push({
        field: 'startsAt',
        message: 'Enrollment start timestamp must be a valid Date.',
      });
    }

    if (props.expiresAt !== null && !this.isValidDate(props.expiresAt)) {
      issues.push({
        field: 'expiresAt',
        message:
          'Enrollment expiration timestamp must be a valid Date or null.',
      });
    }

    if (
      props.expiresAt !== null &&
      props.startsAt.getTime() >= props.expiresAt.getTime()
    ) {
      issues.push({
        field: 'expiresAt',
        message: 'Enrollment expiration must occur after enrollment start.',
      });
    }

    if (!this.isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Creation timestamp must be valid.',
      });
    }

    if (!this.isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Update timestamp must be valid.',
      });
    }

    if (
      props.status === EnrollmentStatus.COMPLETED &&
      props.completedAt === null
    ) {
      issues.push({
        field: 'completedAt',
        message: 'Completed Enrollment must have a completion timestamp.',
      });
    }

    if (
      props.status !== EnrollmentStatus.COMPLETED &&
      props.completedAt !== null
    ) {
      issues.push({
        field: 'completedAt',
        message: 'Only completed Enrollment may have a completion timestamp.',
      });
    }

    if (
      props.status === EnrollmentStatus.CANCELLED &&
      props.cancelledAt === null
    ) {
      issues.push({
        field: 'cancelledAt',
        message: 'Cancelled Enrollment must have a cancellation timestamp.',
      });
    }

    if (
      props.status !== EnrollmentStatus.CANCELLED &&
      props.cancelledAt !== null
    ) {
      issues.push({
        field: 'cancelledAt',
        message: 'Only cancelled Enrollment may have a cancellation timestamp.',
      });
    }

    if (issues.length > 0) {
      throw new EnrollmentValidationError(
        'Enrollment validation failed.',
        issues,
      );
    }
  }

  private isValidDate(value: Date): boolean {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
}
