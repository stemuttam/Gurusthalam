import { CourseValidationError } from '../../errors/index.js';
import { CourseVersionId } from '../../value-objects/course-version-id.js';
import { SectionId } from '../identifiers/section-id.js';

/**
 * Domain representation of a Course Structure Section.
 *
 * A Section is a stable structural node belonging to exactly one
 * CourseVersion.
 *
 * Section identity is independent from ordering. Reordering a Section
 * therefore changes only its position and never its SectionId.
 *
 * The entity intentionally remains independent from:
 * - Prisma
 * - NestJS
 * - HTTP
 * - application services
 * - persistence
 * - content implementations
 * - assessment implementations
 */
export interface SectionProps {
  readonly id: SectionId;
  readonly courseVersionId: CourseVersionId;
  readonly title: string;
  readonly description: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSectionProps {
  readonly courseVersionId: CourseVersionId;
  readonly title: string;
  readonly description?: string | null;
  readonly position: number;
}

type MutableSectionProps = {
  -readonly [Key in keyof SectionProps]: SectionProps[Key];
};

export class Section {
  private readonly props: MutableSectionProps;

  private constructor(props: SectionProps) {
    this.validateProps(props);

    this.props = {
      ...props,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    };
  }

  /**
   * Creates a new Section.
   *
   * New Sections always receive a newly generated identity.
   */
  static create(input: CreateSectionProps): Section {
    const now = new Date();

    return new Section({
      id: SectionId.generate(),
      courseVersionId: input.courseVersionId,
      title: input.title,
      description: input.description ?? null,
      position: input.position,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rehydrates a Section from persisted state.
   *
   * Rehydration never generates a new identity.
   */
  static rehydrate(props: SectionProps): Section {
    return new Section(props);
  }

  get id(): SectionId {
    return this.props.id;
  }

  get courseVersionId(): CourseVersionId {
    return this.props.courseVersionId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get position(): number {
    return this.props.position;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  /**
   * Updates Section metadata.
   *
   * Structural mutability is deliberately enforced outside this entity.
   * The caller is responsible for establishing that the owning
   * CourseVersion is currently mutable before invoking this operation.
   *
   * The entity itself remains responsible for validating the proposed
   * Section state.
   */
  updateMetadata(input: {
    readonly title?: string;
    readonly description?: string | null;
  }): void {
    const title =
      input.title === undefined ? this.props.title : input.title.trim();

    const description =
      input.description === undefined
        ? this.props.description
        : input.description === null
          ? null
          : input.description.trim();

    this.validateTitle(title);
    this.validateDescription(description);

    this.props.title = title;
    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  /**
   * Changes the Section position.
   *
   * Identity and parent CourseVersion ownership remain unchanged.
   *
   * The surrounding structure policy is responsible for validating
   * sibling uniqueness and maintaining deterministic collection ordering.
   */
  moveToPosition(position: number): void {
    this.validatePosition(position);

    if (position === this.props.position) {
      return;
    }

    this.props.position = position;
    this.props.updatedAt = new Date();
  }

  /**
   * Returns a persistence-safe representation of the entity.
   *
   * Date values are detached from the internal entity state.
   */
  toPrimitives(): SectionProps {
    return {
      id: this.props.id,
      courseVersionId: this.props.courseVersionId,
      title: this.props.title,
      description: this.props.description,
      position: this.props.position,
      createdAt: new Date(this.props.createdAt),
      updatedAt: new Date(this.props.updatedAt),
    };
  }

  private validateProps(props: SectionProps): void {
    const issues: Array<{ field: string; message: string }> = [];

    if (!props.id) {
      issues.push({
        field: 'id',
        message: 'Section identifier is required.',
      });
    }

    if (!props.courseVersionId) {
      issues.push({
        field: 'courseVersionId',
        message: 'CourseVersion identifier is required.',
      });
    }

    this.collectValidationIssue(issues, () => this.validateTitle(props.title));

    this.collectValidationIssue(issues, () =>
      this.validateDescription(props.description),
    );

    this.collectValidationIssue(issues, () =>
      this.validatePosition(props.position),
    );

    if (!this.isValidDate(props.createdAt)) {
      issues.push({
        field: 'createdAt',
        message: 'Section creation timestamp must be a valid Date.',
      });
    }

    if (!this.isValidDate(props.updatedAt)) {
      issues.push({
        field: 'updatedAt',
        message: 'Section update timestamp must be a valid Date.',
      });
    }

    if (
      this.isValidDate(props.createdAt) &&
      this.isValidDate(props.updatedAt) &&
      props.createdAt.getTime() > props.updatedAt.getTime()
    ) {
      issues.push({
        field: 'updatedAt',
        message:
          'Section update timestamp cannot be earlier than creation timestamp.',
      });
    }

    if (issues.length > 0) {
      throw new CourseValidationError('Section validation failed.', issues);
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
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new CourseValidationError('Section title is required.', [
        {
          field: 'title',
          message: 'Section title must be a non-empty string.',
        },
      ]);
    }

    if (title.trim().length > 200) {
      throw new CourseValidationError('Section title is too long.', [
        {
          field: 'title',
          message: 'Section title must not exceed 200 characters.',
        },
      ]);
    }
  }

  private validateDescription(description: string | null): void {
    if (
      description !== null &&
      (typeof description !== 'string' || description.trim().length === 0)
    ) {
      throw new CourseValidationError('Section description cannot be empty.', [
        {
          field: 'description',
          message: 'Section description must be null or a non-empty string.',
        },
      ]);
    }

    if (description !== null && description.trim().length > 10_000) {
      throw new CourseValidationError('Section description is too long.', [
        {
          field: 'description',
          message: 'Section description must not exceed 10000 characters.',
        },
      ]);
    }
  }

  private validatePosition(position: number): void {
    if (!Number.isInteger(position) || position < 1) {
      throw new CourseValidationError('Section position is invalid.', [
        {
          field: 'position',
          message: 'Section position must be a positive integer.',
        },
      ]);
    }
  }

  private isValidDate(value: Date): boolean {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
}
