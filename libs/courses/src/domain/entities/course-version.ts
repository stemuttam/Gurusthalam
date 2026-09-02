import {
  CourseValidationError,
} from '../errors/index.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';

export type CourseVersionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface CourseVersionProps {
  readonly id: CourseVersionId;
  readonly courseId: string;
  readonly version: number;
  readonly status: CourseVersionStatus;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
}

export interface CreateCourseVersionProps {
  readonly courseId: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string | null;
}

type MutableCourseVersionProps = {
  -readonly [Key in keyof CourseVersionProps]: CourseVersionProps[Key];
};

/**
 * Domain representation of a Course version.
 *
 * A CourseVersion is intentionally independent from persistence.
 *
 * Published versions are immutable. Once published, their content and
 * identity cannot be modified through domain mutation methods.
 */
export class CourseVersion {
  private readonly props: MutableCourseVersionProps;

  private constructor(props: CourseVersionProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
      publishedAt:
        props.publishedAt === null
          ? null
          : new Date(props.publishedAt),
    };
  }

  static create(input: CreateCourseVersionProps): CourseVersion {
    const now = new Date();

    return new CourseVersion({
      id: CourseVersionId.generate(),
      courseId: input.courseId,
      version: input.version,
      status: 'DRAFT',
      title: input.title,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    });
  }

  static rehydrate(props: CourseVersionProps): CourseVersion {
    return new CourseVersion(props);
  }

  get id(): CourseVersionId {
    return this.props.id;
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get version(): number {
    return this.props.version;
  }

  get status(): CourseVersionStatus {
    return this.props.status;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt === null
      ? null
      : new Date(this.props.publishedAt);
  }

  updateMetadata(input: {
    readonly title?: string;
    readonly description?: string | null;
  }): void {
    this.assertMutable();

    const title = input.title ?? this.props.title;
    const description =
      input.description === undefined
        ? this.props.description
        : input.description;

    this.validateTitle(title);
    this.validateDescription(description);

    this.props.title = title;
    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  submitForReview(): void {
    this.assertStatus('DRAFT');

    this.props.status = 'IN_REVIEW';
    this.props.updatedAt = new Date();
  }

  publish(): void {
    this.assertStatus('IN_REVIEW');

    this.validatePublicationReadiness();

    const now = new Date();

    this.props.status = 'PUBLISHED';
    this.props.publishedAt = now;
    this.props.updatedAt = now;
  }

  archive(): void {
    if (
      this.props.status !== 'PUBLISHED' &&
      this.props.status !== 'IN_REVIEW' &&
      this.props.status !== 'DRAFT'
    ) {
      throw new CourseValidationError(
        'Course version cannot be archived from its current state.',
        [
          {
            field: 'status',
            message: `Cannot archive CourseVersion in ${this.props.status} status.`,
          },
        ],
      );
    }

    this.props.status = 'ARCHIVED';
    this.props.updatedAt = new Date();
  }

  isPublished(): boolean {
    return this.props.status === 'PUBLISHED';
  }

  isMutable(): boolean {
    return this.props.status === 'DRAFT';
  }

  toPrimitives(): CourseVersionProps {
    return {
      id: this.props.id,
      courseId: this.props.courseId,
      version: this.props.version,
      status: this.props.status,
      title: this.props.title,
      description: this.props.description,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
      publishedAt:
        this.props.publishedAt === null
          ? null
          : new Date(this.props.publishedAt),
    };
  }

  private assertMutable(): void {
    if (!this.isMutable()) {
      throw new CourseValidationError(
        'Published or review CourseVersions cannot be modified.',
        [
          {
            field: 'status',
            message:
              'CourseVersion metadata can only be modified while in DRAFT status.',
          },
        ],
      );
    }
  }

  private assertStatus(expected: CourseVersionStatus): void {
    if (this.props.status !== expected) {
      throw new CourseValidationError(
        'Invalid CourseVersion state transition.',
        [
          {
            field: 'status',
            message: `Expected ${expected} status but found ${this.props.status}.`,
          },
        ],
      );
    }
  }

  private validatePublicationReadiness(): void {
    const issues = [];

    if (this.props.title.trim().length === 0) {
      issues.push({
        field: 'title',
        message: 'CourseVersion title is required for publication.',
      });
    }

    if (
      this.props.description !== null &&
      this.props.description.trim().length === 0
    ) {
      issues.push({
        field: 'description',
        message: 'CourseVersion description cannot be empty.',
      });
    }

    if (issues.length > 0) {
      throw new CourseValidationError(
        'CourseVersion is not ready for publication.',
        issues,
      );
    }
  }

  private validateProps(props: CourseVersionProps): void {
    const issues = [];

    if (!props.id) {
      issues.push({
        field: 'id',
        message: 'CourseVersion identifier is required.',
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

    if (
      !Number.isInteger(props.version) ||
      props.version < 1
    ) {
      issues.push({
        field: 'version',
        message: 'CourseVersion number must be a positive integer.',
      });
    }

    this.collectValidationIssue(
      issues,
      () => this.validateTitle(props.title),
    );

    this.collectValidationIssue(
      issues,
      () => this.validateDescription(props.description),
    );

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
      props.publishedAt !== null &&
      !this.isValidDate(props.publishedAt)
    ) {
      issues.push({
        field: 'publishedAt',
        message: 'Publication timestamp must be a valid Date or null.',
      });
    }

    if (
      props.status === 'PUBLISHED' &&
      props.publishedAt === null
    ) {
      issues.push({
        field: 'publishedAt',
        message:
          'A published CourseVersion must have a publication timestamp.',
      });
    }

    if (
      props.status !== 'PUBLISHED' &&
      props.publishedAt !== null
    ) {
      issues.push({
        field: 'publishedAt',
        message:
          'Only a published CourseVersion may have a publication timestamp.',
      });
    }

    if (issues.length > 0) {
      throw new CourseValidationError(
        'CourseVersion validation failed.',
        issues,
      );
    }
  }

  private collectValidationIssue(
    issues: Array<{ field: string; message: string }>,
    validator: () => void,
  ): void {
    try {
      validator();
    } catch (error) {
      if (error instanceof CourseValidationError) {
        issues.push(...error.issues);
        return;
      }

      throw error;
    }
  }

  private validateTitle(title: string): void {
    if (
      typeof title !== 'string' ||
      title.trim().length === 0
    ) {
      throw new CourseValidationError(
        'CourseVersion title is required.',
        [
          {
            field: 'title',
            message:
              'CourseVersion title must be a non-empty string.',
          },
        ],
      );
    }

    if (title.trim().length > 200) {
      throw new CourseValidationError(
        'CourseVersion title is too long.',
        [
          {
            field: 'title',
            message:
              'CourseVersion title must not exceed 200 characters.',
          },
        ],
      );
    }
  }

  private validateDescription(
    description: string | null,
  ): void {
    if (
      description !== null &&
      description.trim().length === 0
    ) {
      throw new CourseValidationError(
        'CourseVersion description cannot be empty.',
        [
          {
            field: 'description',
            message:
              'CourseVersion description must be null or a non-empty string.',
          },
        ],
      );
    }

    if (
      description !== null &&
      description.trim().length > 10_000
    ) {
      throw new CourseValidationError(
        'CourseVersion description is too long.',
        [
          {
            field: 'description',
            message:
              'CourseVersion description must not exceed 10000 characters.',
          },
        ],
      );
    }
  }

  private isValidDate(value: Date): boolean {
    return (
      value instanceof Date &&
      !Number.isNaN(value.getTime())
    );
  }
}