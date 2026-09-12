import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';

export const COURSE_VERSION_AUDIT_EVENT_TYPE = {
  VERSION_CREATED: 'VERSION_CREATED',
  VERSION_SUBMITTED_FOR_REVIEW: 'VERSION_SUBMITTED_FOR_REVIEW',
  VERSION_PUBLISHED: 'VERSION_PUBLISHED',
  VERSION_UNPUBLISHED: 'VERSION_UNPUBLISHED',
  VERSION_ARCHIVED: 'VERSION_ARCHIVED',
  VERSION_ROLLBACK_CREATED: 'VERSION_ROLLBACK_CREATED',
} as const;

export type CourseVersionAuditEventType =
  (typeof COURSE_VERSION_AUDIT_EVENT_TYPE)[keyof typeof COURSE_VERSION_AUDIT_EVENT_TYPE];

export const COURSE_VERSION_AUDIT_ACTOR_TYPE = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  SERVICE: 'SERVICE',
} as const;

export type CourseVersionAuditActorType =
  (typeof COURSE_VERSION_AUDIT_ACTOR_TYPE)[keyof typeof COURSE_VERSION_AUDIT_ACTOR_TYPE];

export type CourseVersionAuditMetadataValue = string | number | boolean | null;

export type CourseVersionAuditMetadata = Readonly<
  Record<string, CourseVersionAuditMetadataValue>
>;

export interface CourseVersionAuditActor {
  readonly type: CourseVersionAuditActorType;
  readonly id: string;
}

export interface CourseVersionAuditProps {
  readonly id: string;
  readonly courseId: string;
  readonly courseVersionId: CourseVersionId;
  readonly version: number;
  readonly eventType: CourseVersionAuditEventType;
  readonly occurredAt: Date;
  readonly actor: CourseVersionAuditActor;
  readonly reason: string | null;
  readonly metadata: CourseVersionAuditMetadata;
}

export interface CreateCourseVersionAuditProps {
  readonly id: string;
  readonly version: CourseVersion;
  readonly eventType: CourseVersionAuditEventType;
  readonly occurredAt?: Date;
  readonly actor: CourseVersionAuditActor;
  readonly reason?: string | null;
  readonly metadata?: CourseVersionAuditMetadata;
}

/**
 * Immutable audit fact for a CourseVersion operation.
 *
 * Audit records describe historical facts. They do not mutate CourseVersion
 * state and do not replace the canonical Course domain-event contracts.
 *
 * The contract intentionally has no dependency on:
 * - Prisma
 * - HTTP
 * - NestJS
 * - queues
 * - notification infrastructure
 * - AI/ML providers
 *
 * A future AI agent may act as an application/service actor without
 * requiring an AI-specific field in this transactional domain contract.
 */
export class CourseVersionAudit {
  private readonly props: CourseVersionAuditProps;

  private constructor(props: CourseVersionAuditProps) {
    this.validateProps(props);

    const actor = Object.freeze({
      type: props.actor.type,
      id: props.actor.id.trim(),
    });

    const metadata = Object.freeze({
      ...props.metadata,
    });

    this.props = Object.freeze({
      id: props.id.trim(),
      courseId: props.courseId.trim(),
      courseVersionId: props.courseVersionId,
      version: props.version,
      eventType: props.eventType,
      occurredAt: new Date(props.occurredAt),
      actor,
      reason: props.reason === null ? null : props.reason.trim(),
      metadata,
    });

    Object.freeze(this);
  }

  static create(input: CreateCourseVersionAuditProps): CourseVersionAudit {
    return new CourseVersionAudit({
      id: input.id,
      courseId: input.version.courseId,
      courseVersionId: input.version.id,
      version: input.version.version,
      eventType: input.eventType,
      occurredAt: input.occurredAt ?? new Date(),
      actor: input.actor,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });
  }

  static rehydrate(props: CourseVersionAuditProps): CourseVersionAudit {
    return new CourseVersionAudit(props);
  }

  get id(): string {
    return this.props.id;
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get courseVersionId(): CourseVersionId {
    return this.props.courseVersionId;
  }

  get version(): number {
    return this.props.version;
  }

  get eventType(): CourseVersionAuditEventType {
    return this.props.eventType;
  }

  get occurredAt(): Date {
    return new Date(this.props.occurredAt);
  }

  get actor(): CourseVersionAuditActor {
    return this.props.actor;
  }

  get reason(): string | null {
    return this.props.reason;
  }

  get metadata(): CourseVersionAuditMetadata {
    return this.props.metadata;
  }

  toPrimitives(): CourseVersionAuditProps {
    return {
      id: this.props.id,
      courseId: this.props.courseId,
      courseVersionId: this.props.courseVersionId,
      version: this.props.version,
      eventType: this.props.eventType,
      occurredAt: new Date(this.props.occurredAt),
      actor: {
        type: this.props.actor.type,
        id: this.props.actor.id,
      },
      reason: this.props.reason,
      metadata: {
        ...this.props.metadata,
      },
    };
  }

  private validateProps(props: CourseVersionAuditProps): void {
    const issues: Array<{
      field: string;
      message: string;
    }> = [];

    if (typeof props.id !== 'string' || props.id.trim().length === 0) {
      issues.push({
        field: 'id',
        message: 'Audit identifier must be a non-empty string.',
      });
    } else if (props.id.trim().length > 200) {
      issues.push({
        field: 'id',
        message: 'Audit identifier must not exceed 200 characters.',
      });
    }

    if (
      typeof props.courseId !== 'string' ||
      props.courseId.trim().length === 0
    ) {
      issues.push({
        field: 'courseId',
        message: 'Course identifier must be a non-empty string.',
      });
    }

    if (!(props.courseVersionId instanceof CourseVersionId)) {
      issues.push({
        field: 'courseVersionId',
        message: 'CourseVersion identifier is required.',
      });
    }

    if (!Number.isInteger(props.version) || props.version < 1) {
      issues.push({
        field: 'version',
        message: 'Version number must be a positive integer.',
      });
    }

    if (!isCourseVersionAuditEventType(props.eventType)) {
      issues.push({
        field: 'eventType',
        message: 'Audit event type is invalid.',
      });
    }

    if (
      !(props.occurredAt instanceof Date) ||
      Number.isNaN(props.occurredAt.getTime())
    ) {
      issues.push({
        field: 'occurredAt',
        message: 'Audit occurrence timestamp must be a valid Date.',
      });
    }

    if (
      !props.actor ||
      typeof props.actor.id !== 'string' ||
      props.actor.id.trim().length === 0
    ) {
      issues.push({
        field: 'actor.id',
        message: 'Audit actor identifier must be a non-empty string.',
      });
    } else if (props.actor.id.trim().length > 200) {
      issues.push({
        field: 'actor.id',
        message: 'Audit actor identifier must not exceed 200 characters.',
      });
    }

    if (!isCourseVersionAuditActorType(props.actor?.type)) {
      issues.push({
        field: 'actor.type',
        message: 'Audit actor type is invalid.',
      });
    }

    if (
      props.reason !== null &&
      (typeof props.reason !== 'string' || props.reason.trim().length === 0)
    ) {
      issues.push({
        field: 'reason',
        message: 'Audit reason must be null or a non-empty string.',
      });
    } else if (
      typeof props.reason === 'string' &&
      props.reason.trim().length > 500
    ) {
      issues.push({
        field: 'reason',
        message: 'Audit reason must not exceed 500 characters.',
      });
    }

    if (props.metadata === null || typeof props.metadata !== 'object') {
      issues.push({
        field: 'metadata',
        message: 'Audit metadata must be an object.',
      });
    } else {
      for (const [key, value] of Object.entries(props.metadata)) {
        if (key.trim().length === 0) {
          issues.push({
            field: 'metadata',
            message: 'Audit metadata keys must not be empty.',
          });

          break;
        }

        if (!isValidCourseVersionAuditMetadataValue(value)) {
          issues.push({
            field: `metadata.${key}`,
            message:
              'Audit metadata values must be string, number, boolean, or null.',
          });
        }
      }
    }

    if (issues.length > 0) {
      throw new TypeError(
        `Invalid CourseVersion audit: ${issues
          .map(({ field, message }) => `${field}: ${message}`)
          .join('; ')}`,
      );
    }
  }
}

export function isCourseVersionAuditEventType(
  value: unknown,
): value is CourseVersionAuditEventType {
  return (
    typeof value === 'string' &&
    Object.values(COURSE_VERSION_AUDIT_EVENT_TYPE).includes(
      value as CourseVersionAuditEventType,
    )
  );
}

export function isCourseVersionAuditActorType(
  value: unknown,
): value is CourseVersionAuditActorType {
  return (
    typeof value === 'string' &&
    Object.values(COURSE_VERSION_AUDIT_ACTOR_TYPE).includes(
      value as CourseVersionAuditActorType,
    )
  );
}

export function isValidCourseVersionAuditMetadataValue(
  value: unknown,
): value is CourseVersionAuditMetadataValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}
