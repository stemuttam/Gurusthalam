import {
  CourseVersionAudit,
  CourseVersionId,
  type CourseVersionAuditActor,
  type CourseVersionAuditEventType,
  type CourseVersionAuditMetadata,
} from '@gurusthalam/courses';

import { Prisma, type CourseVersionAuditModel } from '@gurusthalam/database';

/**
 * Persistence representation used by the Prisma adapter.
 *
 * This contract intentionally remains separate from the generated
 * Prisma model. The mapper is the only infrastructure translation
 * boundary between the domain representation and Prisma persistence.
 */
export interface PrismaCourseVersionAuditPersistence {
  readonly id: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly version: number;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly actorType: string;
  readonly actorId: string;
  readonly reason: string | null;
  readonly metadata: Prisma.InputJsonObject;
}

export type PrismaCourseVersionAuditRecord = CourseVersionAuditModel;

export class CourseVersionAuditPrismaMapper {
  private constructor() {
    // Static mapper; instantiation is intentionally disabled.
  }

  /**
   * Converts a persisted Prisma audit record into the domain audit object.
   *
   * A fresh Date instance is created so the persistence record never
   * shares mutable Date references with the domain object.
   */
  static toDomain(record: PrismaCourseVersionAuditRecord): CourseVersionAudit {
    return CourseVersionAudit.rehydrate({
      id: record.id,

      courseId: record.courseId,

      courseVersionId: CourseVersionId.from(record.courseVersionId),

      version: record.version,

      eventType: record.eventType as CourseVersionAuditEventType,

      occurredAt: new Date(record.occurredAt),

      actor: {
        type: record.actorType as CourseVersionAuditActor['type'],
        id: record.actorId,
      },

      reason: record.reason,

      metadata: CourseVersionAuditPrismaMapper.toDomainMetadata(
        record.metadata,
      ),
    });
  }

  /**
   * Converts a domain audit object into a persistence representation.
   *
   * The returned representation is detached from the domain object,
   * including a fresh Date instance.
   */
  static toPersistence(
    audit: CourseVersionAudit,
  ): PrismaCourseVersionAuditPersistence {
    const props = audit.toPrimitives();

    return {
      id: props.id,

      courseId: props.courseId,

      courseVersionId: props.courseVersionId.value,

      version: props.version,

      eventType: props.eventType,

      occurredAt: new Date(props.occurredAt),

      actorType: props.actor.type,

      actorId: props.actor.id,

      reason: props.reason,

      metadata: CourseVersionAuditPrismaMapper.toPersistenceMetadata(
        props.metadata,
      ),
    };
  }

  /**
   * Converts domain metadata into Prisma's JSON-object boundary.
   *
   * The CourseVersion audit domain intentionally permits primitive
   * values including null. Prisma's generated InputJsonValue type does
   * not model raw JavaScript null at this nested assignment point.
   *
   * Therefore we:
   *   1. construct an ordinary mutable object using the already
   *      domain-validated primitive values;
   *   2. preserve null exactly as JSON null;
   *   3. perform one final infrastructure-bound cast at the return
   *      boundary.
   *
   * No JSON transformation is pushed into the domain layer.
   */
  private static toPersistenceMetadata(
    metadata: CourseVersionAuditMetadata,
  ): Prisma.InputJsonObject {
    const result: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(metadata)) {
      result[key] = value;
    }

    return result as Prisma.InputJsonObject;
  }

  /**
   * Converts persisted Prisma JSON into the constrained domain
   * metadata contract.
   *
   * Nested arrays and objects are deliberately rejected because the
   * domain audit metadata contract currently allows only primitive
   * scalar values and null.
   */
  private static toDomainMetadata(
    value: Prisma.JsonValue,
  ): CourseVersionAuditMetadata {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(
        'CourseVersion audit metadata persistence value must be a JSON object.',
      );
    }

    const metadata: Record<string, string | number | boolean | null> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (
        entry !== null &&
        typeof entry !== 'string' &&
        typeof entry !== 'number' &&
        typeof entry !== 'boolean'
      ) {
        throw new TypeError(
          `CourseVersion audit metadata field "${key}" contains an unsupported nested JSON value.`,
        );
      }

      metadata[key] = entry;
    }

    return metadata;
  }
}
