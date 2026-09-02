import type { CourseVersion } from '../entities/course-version.js';
import type { CourseId } from '../value-objects/course-id.js';
import type { CourseVersionId } from '../value-objects/course-version-id.js';

/**
 * Persistence boundary for CourseVersion.
 *
 * This interface contains domain-level persistence operations only.
 * It deliberately has no dependency on Prisma, SQL, MongoDB, HTTP,
 * or any infrastructure-specific type.
 */
export interface CourseVersionRepository {
  /**
   * Finds a CourseVersion by its identifier.
   *
   * Returns null when the version does not exist.
   */
  findById(id: CourseVersionId): Promise<CourseVersion | null>;

  /**
   * Finds the latest version belonging to a Course.
   *
   * "Latest" is determined by the domain version number, not by database
   * insertion order or timestamp.
   *
   * Returns null when the Course has no versions.
   */
  findLatestByCourseId(courseId: CourseId): Promise<CourseVersion | null>;

  /**
   * Finds the currently published version of a Course.
   *
   * Returns null when the Course has no published version.
   */
  findPublishedByCourseId(
    courseId: CourseId,
  ): Promise<CourseVersion | null>;

  /**
   * Determines whether a specific version number already exists for a Course.
   *
   * This supports the domain invariant that a Course should not contain
   * duplicate version numbers.
   */
  existsByCourseIdAndVersion(
    courseId: CourseId,
    version: number,
  ): Promise<boolean>;

  /**
   * Persists the current state of a CourseVersion.
   *
   * The implementation decides whether the operation is an insert or update.
   */
  save(courseVersion: CourseVersion): Promise<void>;
}