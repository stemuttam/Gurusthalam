import {
  CourseVersionId,
  CourseVersionLineage,
  type CourseVersionLineageRelation,
} from '@gurusthalam/courses';

import type { CourseVersionLineageModel } from '@gurusthalam/database';

/**
 * Infrastructure persistence representation for CourseVersion lineage.
 *
 * The database-owned `id` intentionally does not cross into the domain
 * because CourseVersionLineage has no standalone domain identity.
 */
export interface PrismaCourseVersionLineagePersistence {
  readonly courseId: string;
  readonly sourceVersionId: string;
  readonly sourceVersion: number;
  readonly targetVersionId: string;
  readonly targetVersion: number;
  readonly relation: string;
  readonly reason: string;
}

/**
 * Generated Prisma record consumed by the mapper.
 */
export type PrismaCourseVersionLineageRecord = CourseVersionLineageModel;

export class CourseVersionLineagePrismaMapper {
  private constructor() {
    // Static mapper.
  }

  static toDomain(
    record: PrismaCourseVersionLineageRecord,
  ): CourseVersionLineage {
    return CourseVersionLineage.rehydrate({
      courseId: record.courseId,

      sourceVersionId: CourseVersionId.from(record.sourceVersionId),

      sourceVersion: record.sourceVersion,

      targetVersionId: CourseVersionId.from(record.targetVersionId),

      targetVersion: record.targetVersion,

      relation: record.relation as CourseVersionLineageRelation,

      reason: record.reason,
    });
  }

  static toPersistence(
    lineage: CourseVersionLineage,
  ): PrismaCourseVersionLineagePersistence {
    const props = lineage.toPrimitives();

    return {
      courseId: props.courseId,

      sourceVersionId: props.sourceVersionId.value,

      sourceVersion: props.sourceVersion,

      targetVersionId: props.targetVersionId.value,

      targetVersion: props.targetVersion,

      relation: props.relation,

      reason: props.reason,
    };
  }
}
