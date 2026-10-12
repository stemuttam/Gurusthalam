import type { CourseStructure } from '../structure/course-structure.js';
import type { CourseVersionId } from '../value-objects/course-version-id.js';

/**
 * Persistence boundary for the complete instructional structure of a
 * specific CourseVersion.
 *
 * Implementations must preserve structural identities and must persist the
 * complete aggregate atomically. A missing CourseVersion returns null;
 * an existing CourseVersion without Sections returns an empty structure.
 */
export interface CourseStructureRepository {
  findByCourseVersionId(
    courseVersionId: CourseVersionId,
  ): Promise<CourseStructure | null>;

  save(structure: CourseStructure): Promise<void>;
}
