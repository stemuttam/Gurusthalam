import { CourseVersion } from '../entities/course-version.js';
import {
  type CourseVersionSnapshot,
  createCourseVersionSnapshot,
} from './course-version-snapshot.js';

export interface CourseVersionHistoryEntry {
  readonly snapshot: CourseVersionSnapshot;
  readonly isHistorical: boolean;
  readonly isPublished: boolean;
}

export interface CourseVersionHistoryProps {
  readonly courseId: string;
  readonly entries: readonly CourseVersionHistoryEntry[];
}

/**
 * Immutable, deterministic history of CourseVersion snapshots belonging to
 * one Course.
 *
 * CourseVersionHistory is a read-side domain boundary.
 *
 * It intentionally:
 * - does not mutate CourseVersion aggregates
 * - does not persist anything
 * - does not know about Prisma
 * - does not know about HTTP/NestJS
 * - does not contain AI/ML concerns
 *
 * The history is ordered by business version number, not by timestamps or
 * persistence insertion order.
 */
export class CourseVersionHistory {
  private readonly props: CourseVersionHistoryProps;

  private constructor(props: CourseVersionHistoryProps) {
    this.validate(props);

    const entries = Object.freeze([...props.entries]);

    this.props = Object.freeze({
      courseId: props.courseId,
      entries,
    });

    Object.freeze(this);
  }

  /**
   * Creates immutable history from CourseVersion aggregates.
   *
   * The input collection is never mutated.
   */
  static create(versions: readonly CourseVersion[]): CourseVersionHistory {
    if (versions.length === 0) {
      throw new TypeError(
        'CourseVersionHistory requires at least one CourseVersion.',
      );
    }

    const sortedVersions = [...versions].sort(
      (left, right) => left.version - right.version,
    );

    const firstVersion = sortedVersions.at(0);

    if (firstVersion === undefined) {
      throw new TypeError(
        'CourseVersionHistory requires at least one CourseVersion.',
      );
    }

    const entries = sortedVersions.map((version) => ({
      snapshot: createCourseVersionSnapshot(version),
      isHistorical:
        version.status === 'PUBLISHED' || version.status === 'ARCHIVED',
      isPublished: version.status === 'PUBLISHED',
    }));

    return new CourseVersionHistory({
      courseId: firstVersion.courseId,
      entries,
    });
  }

  /**
   * Rehydrates a previously persisted/read-model history representation.
   *
   * The caller must provide an already materialized snapshot collection.
   * No persistence-specific types are required.
   */
  static rehydrate(props: CourseVersionHistoryProps): CourseVersionHistory {
    const entries = [...props.entries].sort(
      (left, right) => left.snapshot.version - right.snapshot.version,
    );

    return new CourseVersionHistory({
      courseId: props.courseId,
      entries,
    });
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get size(): number {
    return this.props.entries.length;
  }

  /**
   * Returns immutable history entries in ascending business-version order.
   */
  get entries(): readonly CourseVersionHistoryEntry[] {
    return this.props.entries;
  }

  /**
   * Returns the latest CourseVersion snapshot.
   */
  latest(): CourseVersionSnapshot {
    const latestEntry = this.props.entries.at(-1);

    if (latestEntry === undefined) {
      throw new Error('CourseVersionHistory is empty.');
    }

    return latestEntry.snapshot;
  }

  /**
   * Finds a version by its business version number.
   */
  findByVersion(version: number): CourseVersionSnapshot | null {
    const entry = this.props.entries.find(
      (candidate) => candidate.snapshot.version === version,
    );

    return entry?.snapshot ?? null;
  }

  /**
   * Finds a version by its opaque CourseVersion identity.
   */
  findById(id: string): CourseVersionSnapshot | null {
    const entry = this.props.entries.find(
      (candidate) => candidate.snapshot.id === id,
    );

    return entry?.snapshot ?? null;
  }

  /**
   * Returns all published version snapshots in ascending version order.
   */
  publishedVersions(): readonly CourseVersionSnapshot[] {
    return this.props.entries
      .filter((entry) => entry.isPublished)
      .map((entry) => entry.snapshot);
  }

  /**
   * Determines whether a business version exists in history.
   */
  containsVersion(version: number): boolean {
    return this.findByVersion(version) !== null;
  }

  /**
   * Returns business version numbers in deterministic ascending order.
   */
  versionNumbers(): readonly number[] {
    return Object.freeze(
      this.props.entries.map((entry) => entry.snapshot.version),
    );
  }

  toPrimitives(): CourseVersionHistoryProps {
    return {
      courseId: this.props.courseId,
      entries: this.props.entries.map((entry) => ({
        snapshot: {
          ...entry.snapshot,
        },
        isHistorical: entry.isHistorical,
        isPublished: entry.isPublished,
      })),
    };
  }

  private validate(props: CourseVersionHistoryProps): void {
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
        message: 'Course identifier must be a non-empty string.',
      });
    }

    if (props.entries.length === 0) {
      issues.push({
        field: 'entries',
        message: 'CourseVersionHistory requires at least one entry.',
      });
    }

    const versionNumbers = new Set<number>();

    const versionIds = new Set<string>();

    for (const [index, entry] of props.entries.entries()) {
      const prefix = `entries[${index}]`;

      if (
        typeof entry.snapshot.id !== 'string' ||
        entry.snapshot.id.trim().length === 0
      ) {
        issues.push({
          field: `${prefix}.snapshot.id`,
          message: 'CourseVersion snapshot identifier must be non-empty.',
        });
      } else if (versionIds.has(entry.snapshot.id)) {
        issues.push({
          field: `${prefix}.snapshot.id`,
          message:
            'CourseVersionHistory cannot contain duplicate version identities.',
        });
      } else {
        versionIds.add(entry.snapshot.id);
      }

      if (entry.snapshot.courseId !== props.courseId) {
        issues.push({
          field: `${prefix}.snapshot.courseId`,
          message:
            'All CourseVersion history entries must belong to the same Course.',
        });
      }

      if (
        !Number.isInteger(entry.snapshot.version) ||
        entry.snapshot.version < 1
      ) {
        issues.push({
          field: `${prefix}.snapshot.version`,
          message: 'CourseVersion number must be a positive integer.',
        });
      } else if (versionNumbers.has(entry.snapshot.version)) {
        issues.push({
          field: `${prefix}.snapshot.version`,
          message:
            'CourseVersionHistory cannot contain duplicate version numbers.',
        });
      } else {
        versionNumbers.add(entry.snapshot.version);
      }

      if (entry.isPublished !== (entry.snapshot.status === 'PUBLISHED')) {
        issues.push({
          field: `${prefix}.isPublished`,
          message:
            'Published history metadata must agree with the snapshot status.',
        });
      }

      if (
        entry.isHistorical !==
        (entry.snapshot.status === 'PUBLISHED' ||
          entry.snapshot.status === 'ARCHIVED')
      ) {
        issues.push({
          field: `${prefix}.isHistorical`,
          message:
            'Historical history metadata must agree with the snapshot status.',
        });
      }
    }

    const sortedVersions = [...props.entries].sort(
      (left, right) => left.snapshot.version - right.snapshot.version,
    );

    for (let index = 1; index < sortedVersions.length; index += 1) {
      const previousEntry = sortedVersions.at(index - 1);

      const currentEntry = sortedVersions.at(index);

      if (previousEntry === undefined || currentEntry === undefined) {
        issues.push({
          field: 'entries',
          message:
            'CourseVersionHistory entries could not be evaluated deterministically.',
        });

        break;
      }

      const previous = previousEntry.snapshot.version;

      const current = currentEntry.snapshot.version;

      if (current <= previous) {
        issues.push({
          field: 'entries',
          message:
            'CourseVersionHistory entries must have deterministic ascending version order.',
        });

        break;
      }
    }

    if (issues.length > 0) {
      throw new TypeError(
        `Invalid CourseVersionHistory: ${issues
          .map(({ field, message }) => `${field}: ${message}`)
          .join('; ')}`,
      );
    }
  }
}
