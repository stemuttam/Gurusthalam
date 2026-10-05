import { randomUUID } from 'node:crypto';

import {
  EntitlementValidationError,
  InvalidEntitlementTransitionError,
} from './entitlement-error.js';

import {
  createEntitlementExpiredEvent,
  createEntitlementGrantedEvent,
  createEntitlementRestoredEvent,
  createEntitlementRevokedEvent,
  createEntitlementSuspendedEvent,
  type EntitlementEvent,
  type EntitlementLifecyclePayload,
} from './entitlement-events.js';

import type { EntitlementSource } from './entitlement-source.js';

import {
  EntitlementStatus,
  type EntitlementStatus as EntitlementStatusValue,
} from './entitlement-status.js';

export interface EntitlementProps {
  readonly id: string;
  readonly enrollmentId: string;
  readonly status: EntitlementStatusValue;
  readonly source: EntitlementSource;
  readonly startsAt: Date;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateEntitlementProps {
  readonly enrollmentId: string;
  readonly source: EntitlementSource;
  readonly startsAt?: Date;
  readonly expiresAt?: Date | null;
  readonly now?: Date;
}

type MutableEntitlementProps = {
  -readonly [K in keyof EntitlementProps]: EntitlementProps[K];
};

export class Entitlement {
  private readonly props: MutableEntitlementProps;

  private readonly domainEvents: EntitlementEvent[] = [];

  private constructor(props: EntitlementProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      startsAt: new Date(props.startsAt),
      expiresAt: props.expiresAt === null ? null : new Date(props.expiresAt),
      revokedAt: props.revokedAt === null ? null : new Date(props.revokedAt),
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  static create(input: CreateEntitlementProps): Entitlement {
    const now = input.now ? new Date(input.now) : new Date();

    const startsAt =
      input.startsAt === undefined ? new Date(now) : new Date(input.startsAt);

    const entitlement = new Entitlement({
      id: randomUUID(),
      enrollmentId: input.enrollmentId,
      status: EntitlementStatus.ACTIVE,
      source: input.source,
      startsAt,
      expiresAt:
        input.expiresAt === undefined || input.expiresAt === null
          ? null
          : new Date(input.expiresAt),
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    entitlement.domainEvents.push(
      createEntitlementGrantedEvent(
        entitlement.id,
        {
          entitlementId: entitlement.id,
          enrollmentId: entitlement.enrollmentId,
          source: entitlement.source,
          status: entitlement.status,
          startsAt: entitlement.startsAt,
          expiresAt: entitlement.expiresAt,
        },
        now,
      ),
    );

    return entitlement;
  }

  static rehydrate(props: EntitlementProps): Entitlement {
    return new Entitlement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get enrollmentId(): string {
    return this.props.enrollmentId;
  }

  get status(): EntitlementStatusValue {
    return this.props.status;
  }

  get source(): EntitlementSource {
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

  get revokedAt(): Date | null {
    return this.props.revokedAt === null
      ? null
      : new Date(this.props.revokedAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  suspend(now: Date = new Date()): void {
    this.transition(
      EntitlementStatus.ACTIVE,
      EntitlementStatus.SUSPENDED,
      now,
      (occurredAt, previousStatus) =>
        createEntitlementSuspendedEvent(
          this.id,
          this.lifecyclePayload(previousStatus, EntitlementStatus.SUSPENDED),
          occurredAt,
        ),
    );
  }

  restore(now: Date = new Date()): void {
    this.transition(
      EntitlementStatus.SUSPENDED,
      EntitlementStatus.ACTIVE,
      now,
      (occurredAt, previousStatus) =>
        createEntitlementRestoredEvent(
          this.id,
          this.lifecyclePayload(previousStatus, EntitlementStatus.ACTIVE),
          occurredAt,
        ),
    );
  }

  revoke(now: Date = new Date()): void {
    if (
      this.status !== EntitlementStatus.ACTIVE &&
      this.status !== EntitlementStatus.SUSPENDED
    ) {
      throw new InvalidEntitlementTransitionError(
        `Cannot revoke entitlement from status ${this.status}.`,
        [
          {
            field: 'status',
            message: `Expected ACTIVE or SUSPENDED, received ${this.status}.`,
          },
        ],
      );
    }

    const previousStatus = this.status;
    const occurredAt = this.validateTransitionDate(now);

    this.props.status = EntitlementStatus.REVOKED;
    this.props.revokedAt = new Date(occurredAt);
    this.props.updatedAt = new Date(occurredAt);

    this.domainEvents.push(
      createEntitlementRevokedEvent(
        this.id,
        this.lifecyclePayload(previousStatus, EntitlementStatus.REVOKED),
        occurredAt,
      ),
    );
  }

  expire(now: Date = new Date()): void {
    if (
      this.status !== EntitlementStatus.ACTIVE &&
      this.status !== EntitlementStatus.SUSPENDED
    ) {
      throw new InvalidEntitlementTransitionError(
        `Cannot expire entitlement from status ${this.status}.`,
        [
          {
            field: 'status',
            message: `Expected ACTIVE or SUSPENDED, received ${this.status}.`,
          },
        ],
      );
    }

    const previousStatus = this.status;
    const occurredAt = this.validateTransitionDate(now);

    this.props.status = EntitlementStatus.EXPIRED;
    this.props.updatedAt = new Date(occurredAt);

    this.domainEvents.push(
      createEntitlementExpiredEvent(
        this.id,
        this.lifecyclePayload(previousStatus, EntitlementStatus.EXPIRED),
        occurredAt,
      ),
    );
  }

  isCurrentlyUsable(now: Date = new Date()): boolean {
    const evaluatedAt = this.validateTransitionDate(now);

    if (this.status !== EntitlementStatus.ACTIVE) {
      return false;
    }

    if (evaluatedAt.getTime() < this.startsAt.getTime()) {
      return false;
    }

    return (
      this.expiresAt === null ||
      evaluatedAt.getTime() < this.expiresAt.getTime()
    );
  }

  getDomainEvents(): readonly EntitlementEvent[] {
    return structuredClone(this.domainEvents);
  }

  pullDomainEvents(): EntitlementEvent[] {
    const events = structuredClone(this.domainEvents);

    this.domainEvents.length = 0;

    return events;
  }

  toPrimitives(): EntitlementProps {
    return {
      id: this.id,
      enrollmentId: this.enrollmentId,
      status: this.status,
      source: this.source,
      startsAt: this.startsAt,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private transition(
    expected: EntitlementStatusValue,
    next: EntitlementStatusValue,
    now: Date,
    createEvent: (
      occurredAt: Date,
      previousStatus: EntitlementStatusValue,
    ) => EntitlementEvent,
  ): void {
    if (this.status !== expected) {
      throw new InvalidEntitlementTransitionError(
        `Cannot transition entitlement from ${this.status} to ${next}.`,
        [
          {
            field: 'status',
            message: `Expected ${expected}, received ${this.status}.`,
          },
        ],
      );
    }

    const previousStatus = this.status;
    const occurredAt = this.validateTransitionDate(now);

    this.props.status = next;
    this.props.updatedAt = new Date(occurredAt);

    this.domainEvents.push(createEvent(occurredAt, previousStatus));
  }

  private lifecyclePayload(
    previousStatus: EntitlementStatusValue,
    currentStatus: EntitlementStatusValue,
  ): EntitlementLifecyclePayload {
    return {
      entitlementId: this.id,
      enrollmentId: this.enrollmentId,
      previousStatus,
      currentStatus,
    };
  }

  private validateTransitionDate(now: Date): Date {
    const value = new Date(now);

    if (Number.isNaN(value.getTime())) {
      throw new EntitlementValidationError(
        'Entitlement transition time is invalid.',
        [
          {
            field: 'now',
            message: 'Expected a valid Date.',
          },
        ],
      );
    }

    return value;
  }

  private validateProps(props: EntitlementProps): void {
    const issues: Array<{
      field: string;
      message: string;
    }> = [];

    if (props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'Entitlement id is required.',
      });
    }

    if (props.enrollmentId.trim().length === 0) {
      issues.push({
        field: 'enrollmentId',
        message: 'Enrollment id is required.',
      });
    }

    if (!this.isValidDate(props.startsAt)) {
      issues.push({
        field: 'startsAt',
        message: 'Entitlement start timestamp must be a valid Date.',
      });
    }

    if (props.expiresAt !== null && !this.isValidDate(props.expiresAt)) {
      issues.push({
        field: 'expiresAt',
        message:
          'Entitlement expiration timestamp must be a valid Date or null.',
      });
    }

    if (
      this.isValidDate(props.startsAt) &&
      props.expiresAt !== null &&
      this.isValidDate(props.expiresAt) &&
      props.startsAt.getTime() > props.expiresAt.getTime()
    ) {
      issues.push({
        field: 'expiresAt',
        message: 'Expiration must not precede the start time.',
      });
    }

    if (props.revokedAt !== null && !this.isValidDate(props.revokedAt)) {
      issues.push({
        field: 'revokedAt',
        message: 'Revocation timestamp must be a valid Date or null.',
      });
    }

    if (!this.isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Creation timestamp must be a valid Date.',
      });
    }

    if (!this.isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Update timestamp must be a valid Date.',
      });
    }

    if (
      props.status === EntitlementStatus.REVOKED &&
      props.revokedAt === null
    ) {
      issues.push({
        field: 'revokedAt',
        message: 'Revoked Entitlement must have a revocation timestamp.',
      });
    }

    if (
      props.status !== EntitlementStatus.REVOKED &&
      props.revokedAt !== null
    ) {
      issues.push({
        field: 'revokedAt',
        message: 'Only revoked Entitlement may have a revocation timestamp.',
      });
    }

    if (issues.length > 0) {
      throw new EntitlementValidationError(
        'Invalid Entitlement state.',
        issues,
      );
    }
  }

  private isValidDate(value: Date): boolean {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
}
