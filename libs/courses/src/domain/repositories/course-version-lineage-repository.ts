import type { CourseVersionLineage } from '../versioning/course-version-lineage.js';
import type { CourseVersionId } from '../value-objects/course-version-id.js';

/**
 * Persistence boundary for immutable CourseVersion lineage relationships.
 *
 * A lineage relationship describes how one CourseVersion was derived from
 * another CourseVersion within the same Course.
 *
 * The domain owns lineage invariants. Implementations of this interface are
 * responsible only for persistence and deterministic retrieval.
 */
export interface CourseVersionLineageRepository {
  /**
   * Append one immutable lineage relationship.
   */
  append(
    lineage: CourseVersionLineage,
  ): Promise<void>;

  /**
   * Find all lineage relationships originating from a source version.
   *
   * Results must be deterministic:
   * targetVersion ASC, then targetVersionId ASC.
   */
  findBySourceVersionId(
    sourceVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionLineage[]>;

  /**
   * Find all lineage relationships targeting a version.
   *
   * Results must be deterministic:
   * sourceVersion ASC, then sourceVersionId ASC.
   */
  findByTargetVersionId(
    targetVersionId: CourseVersionId,
  ): Promise<readonly CourseVersionLineage[]>;

  /**
   * Find all lineage relationships belonging to a Course.
   *
   * Results must be deterministic:
   * targetVersion ASC, sourceVersion ASC, targetVersionId ASC.
   */
  findByCourseId(
    courseId: string,
  ): Promise<readonly CourseVersionLineage[]>;
}