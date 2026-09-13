import type { CourseVersionAudit } from '../versioning/course-version-audit.js';
import type { CourseVersionId } from '../value-objects/course-version-id.js';

/**
 * Persistence boundary for immutable CourseVersion audit facts.
 *
 * Audit persistence is append-oriented by contract:
 * - entries may be appended
 * - entries may be queried
 * - entries are never updated
 * - entries are never deleted through this repository
 *
 * Infrastructure-specific concerns such as Prisma and PostgreSQL remain
 * outside the Courses domain package.
 */
export interface CourseVersionAuditRepository {
  /**
   * Appends an immutable audit entry.
   *
   * Implementations must not update or overwrite an existing audit entry.
   */
  append(
    audit: CourseVersionAudit,
  ): Promise<void>;

  /**
   * Returns audit entries for one CourseVersion.
   *
   * Results must be deterministic:
   * occurredAt ASC, then audit id ASC.
   */
  findByCourseVersionId(
    courseVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionAudit[]>;

  /**
   * Returns audit entries for every version belonging to one Course.
   *
   * Results must be deterministic:
   * occurredAt ASC, version ASC, then audit id ASC.
   */
  findByCourseId(
    courseId: string,
  ): Promise<readonly CourseVersionAudit[]>;
}