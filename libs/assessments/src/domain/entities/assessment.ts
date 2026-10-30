import {
  AssessmentStatus,
  type AssessmentStatus as AssessmentStatusValue,
} from '../enums/assessment-status.js';

import {
  AssessmentValidationError,
  InvalidAssessmentStateTransitionError,
} from '../errors/index.js';

import { canTransitionAssessmentLifecycle } from '../lifecycle/assessment-lifecycle.policy.js';

import { AssessmentId } from '../identifiers/assessment-id.js';

/**
 * Complete immutable external representation of Assessment state.
 *
 * Date values are copied at every aggregate boundary.
 */
export interface AssessmentProps {
  readonly id: AssessmentId;
  readonly status: AssessmentStatusValue;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Persistence-neutral primitive snapshot of Assessment state.
 *
 * AssessmentId remains a domain value object. Persistence adapters are
 * responsible for converting it into their own identifier representation.
 */
export type AssessmentPrimitives = AssessmentProps;

type MutableAssessmentProps = {
  -readonly [Key in keyof AssessmentProps]: AssessmentProps[Key];
};

/**
 * Assessment aggregate root.
 *
 * The aggregate owns:
 * - Assessment identity;
 * - generic Assessment lifecycle state;
 * - creation and update timestamps;
 * - lifecycle transition invariants.
 *
 * Creation and rehydration are intentionally separate operations:
 * - create() generates a new identity and initializes DRAFT state;
 * - rehydrate() preserves persisted identity and lifecycle state.
 *
 * Authentication, authorization, tenant resolution, specialized assessment
 * behavior, persistence, transport, and infrastructure remain outside
 * this aggregate.
 */
export class Assessment {
  private readonly props: MutableAssessmentProps;

  private constructor(props: AssessmentProps) {
    this.validateProps(props);

    this.props = {
      id: props.id,
      status: props.status,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  /**
   * Creates a new generic Assessment in DRAFT state.
   */
  static create(): Assessment {
    const now = new Date();

    return new Assessment({
      id: AssessmentId.generate(),
      status: AssessmentStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rehydrates an existing Assessment from a validated state snapshot.
   *
   * Rehydration does not generate a new identity, reset lifecycle state,
   * or perform a domain lifecycle transition.
   */
  static rehydrate(props: AssessmentProps): Assessment {
    return new Assessment(props);
  }

  get id(): AssessmentId {
    return this.props.id;
  }

  get status(): AssessmentStatusValue {
    return this.props.status;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  /**
   * Publishes a DRAFT Assessment.
   *
   * This generic transition does not assert readiness of Quiz, Assignment,
   * Exam, Question Bank, or other specialized assessment content.
   */
  publish(): void {
    this.transitionStatus(AssessmentStatus.PUBLISHED);
  }

  /**
   * Archives a published Assessment.
   *
   * ARCHIVED is terminal and cannot be restored through this aggregate
   * lifecycle contract.
   */
  archive(): void {
    this.transitionStatus(AssessmentStatus.ARCHIVED);
  }

  /**
   * Returns a persistence-neutral defensive snapshot of aggregate state.
   *
   * The AssessmentId is an immutable value object. Date instances are
   * defensively copied so callers cannot mutate aggregate timestamps.
   */
  toPrimitives(): AssessmentPrimitives {
    return {
      id: this.props.id,
      status: this.props.status,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  /**
   * Single lifecycle mutation boundary.
   *
   * Successful transition:
   *   eligibility
   *     -> status mutation
   *     -> timestamp mutation
   *
   * Rejected transition:
   *   -> no aggregate mutation
   *   -> no timestamp mutation
   */
  private transitionStatus(nextStatus: AssessmentStatusValue): void {
    const previousStatus = this.props.status;

    if (!canTransitionAssessmentLifecycle(previousStatus, nextStatus)) {
      throw new InvalidAssessmentStateTransitionError(
        `Assessment cannot transition from ${previousStatus} to ${nextStatus}.`,
        [
          {
            field: 'status',
            message: `Transition from ${previousStatus} to ${nextStatus} is not permitted.`,
          },
        ],
      );
    }

    // Calculate the new timestamp before mutating aggregate state.
    // Never allow updatedAt to move backwards if the system clock changes.
    const nextUpdatedAt = new Date(
      Math.max(Date.now(), this.props.updatedAt.getTime()),
    );

    // All validation and calculations have completed successfully.
    // The following assignments are the single mutation boundary.
    this.props.status = nextStatus;
    this.props.updatedAt = nextUpdatedAt;
  }

  /**
   * Validates the complete aggregate snapshot during construction.
   *
   * Both create() and rehydrate() pass through this boundary.
   */
  private validateProps(props: AssessmentProps): void {
    const issues = [];

    if (!(props.id instanceof AssessmentId)) {
      issues.push({
        field: 'id',
        message: 'Assessment identifier must be a valid AssessmentId.',
      });
    }

    if (!this.isValidStatus(props.status)) {
      issues.push({
        field: 'status',
        message: 'Assessment status must be a supported lifecycle state.',
      });
    }

    const hasValidCreatedAt = this.isValidDate(props.createdAt);
    const hasValidUpdatedAt = this.isValidDate(props.updatedAt);

    if (!hasValidCreatedAt) {
      issues.push({
        field: 'createdAt',
        message: 'Assessment creation timestamp must be a valid Date.',
      });
    }

    if (!hasValidUpdatedAt) {
      issues.push({
        field: 'updatedAt',
        message: 'Assessment update timestamp must be a valid Date.',
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
          'Assessment update timestamp cannot be earlier than creation timestamp.',
      });
    }

    if (issues.length > 0) {
      throw new AssessmentValidationError(
        'Assessment aggregate validation failed.',
        issues,
      );
    }
  }

  private isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  private isValidStatus(value: unknown): value is AssessmentStatusValue {
    return (
      typeof value === 'string' &&
      Object.values(AssessmentStatus).includes(value as AssessmentStatusValue)
    );
  }
}
