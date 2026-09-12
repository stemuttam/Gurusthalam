import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';

export const COURSE_VERSION_LINEAGE_RELATION = 'DERIVED_FROM' as const;

export type CourseVersionLineageRelation =
  typeof COURSE_VERSION_LINEAGE_RELATION;

export interface CourseVersionLineageProps {
  readonly courseId: string;
  readonly sourceVersionId: CourseVersionId;
  readonly sourceVersion: number;
  readonly targetVersionId: CourseVersionId;
  readonly targetVersion: number;
  readonly relation: CourseVersionLineageRelation;
  readonly reason: string;
}

export interface CreateCourseVersionLineageProps {
  readonly source: CourseVersion;
  readonly target: CourseVersion;
  readonly reason: string;
}

/**
 * Immutable derivation relationship between two CourseVersions.
 *
 * A lineage record states that a target CourseVersion was derived from an
 * earlier source CourseVersion belonging to the same Course.
 *
 * The relationship itself never changes after creation.
 */
export class CourseVersionLineage {
  private readonly props: CourseVersionLineageProps;

  private constructor(props: CourseVersionLineageProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      reason: props.reason.trim(),
    };

    Object.freeze(this.props);
    Object.freeze(this);
  }

  static create(
    input: CreateCourseVersionLineageProps,
  ): CourseVersionLineage {
    if (input.source.courseId !== input.target.courseId) {
      throw new TypeError(
        'CourseVersion lineage requires source and target versions to belong to the same Course.',
      );
    }

    return new CourseVersionLineage({
      courseId: input.source.courseId,
      sourceVersionId: input.source.id,
      sourceVersion: input.source.version,
      targetVersionId: input.target.id,
      targetVersion: input.target.version,
      relation: COURSE_VERSION_LINEAGE_RELATION,
      reason: input.reason,
    });
  }

  static rehydrate(
    props: CourseVersionLineageProps,
  ): CourseVersionLineage {
    return new CourseVersionLineage(props);
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get sourceVersionId(): CourseVersionId {
    return this.props.sourceVersionId;
  }

  get sourceVersion(): number {
    return this.props.sourceVersion;
  }

  get targetVersionId(): CourseVersionId {
    return this.props.targetVersionId;
  }

  get targetVersion(): number {
    return this.props.targetVersion;
  }

  get relation(): CourseVersionLineageRelation {
    return this.props.relation;
  }

  get reason(): string {
    return this.props.reason;
  }

  toPrimitives(): CourseVersionLineageProps {
    return {
      courseId: this.props.courseId,
      sourceVersionId: this.props.sourceVersionId,
      sourceVersion: this.props.sourceVersion,
      targetVersionId: this.props.targetVersionId,
      targetVersion: this.props.targetVersion,
      relation: this.props.relation,
      reason: this.props.reason,
    };
  }

  private validateProps(
    props: CourseVersionLineageProps,
  ): void {
    const issues: Array<{
      field: string;
      message: string;
    }> = [];

    if (
      typeof props.courseId !== 'string' ||
      props.courseId.trim().length === 0
    ) {
      issues.push({
        field: 'courseId',
        message:
          'Course identifier must be a non-empty string.',
      });
    }

    if (!(props.sourceVersionId instanceof CourseVersionId)) {
      issues.push({
        field: 'sourceVersionId',
        message:
          'Source CourseVersion identifier is required.',
      });
    }

    if (!(props.targetVersionId instanceof CourseVersionId)) {
      issues.push({
        field: 'targetVersionId',
        message:
          'Target CourseVersion identifier is required.',
      });
    }

    if (
      props.sourceVersionId instanceof CourseVersionId &&
      props.targetVersionId instanceof CourseVersionId &&
      props.sourceVersionId.equals(props.targetVersionId)
    ) {
      issues.push({
        field: 'targetVersionId',
        message:
          'A CourseVersion cannot derive lineage from itself.',
      });
    }

    if (
      !Number.isInteger(props.sourceVersion) ||
      props.sourceVersion < 1
    ) {
      issues.push({
        field: 'sourceVersion',
        message:
          'Source version must be a positive integer.',
      });
    }

    if (
      !Number.isInteger(props.targetVersion) ||
      props.targetVersion < 1
    ) {
      issues.push({
        field: 'targetVersion',
        message:
          'Target version must be a positive integer.',
      });
    }

    if (
      Number.isInteger(props.sourceVersion) &&
      Number.isInteger(props.targetVersion) &&
      props.targetVersion <= props.sourceVersion
    ) {
      issues.push({
        field: 'targetVersion',
        message:
          'Target version must be greater than the source version.',
      });
    }

    if (
      props.relation !== COURSE_VERSION_LINEAGE_RELATION
    ) {
      issues.push({
        field: 'relation',
        message:
          `Unsupported CourseVersion lineage relation: ${String(
            props.relation,
          )}.`,
      });
    }

    if (
      typeof props.reason !== 'string' ||
      props.reason.trim().length === 0
    ) {
      issues.push({
        field: 'reason',
        message:
          'Lineage reason must be a non-empty string.',
      });
    } else if (props.reason.trim().length > 500) {
      issues.push({
        field: 'reason',
        message:
          'Lineage reason must not exceed 500 characters.',
      });
    }

    if (issues.length > 0) {
      throw new TypeError(
        `Invalid CourseVersion lineage: ${issues
          .map(
            ({ field, message }) =>
              `${field}: ${message}`,
          )
          .join('; ')}`,
      );
    }
  }
}