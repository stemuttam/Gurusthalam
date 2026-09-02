import type { Course } from '../entities/course.js';
import type { CourseId } from '../value-objects/course-id.js';

/**
 * Persistence boundary for the Course aggregate.
 *
 * This interface is intentionally infrastructure-agnostic.
 *
 * Implementations may use Prisma, SQL, MongoDB, an API, or another
 * persistence mechanism without leaking those concerns into the domain.
 */
export interface CourseRepository {
  /**
   * Finds a Course by its domain identifier.
   *
   * Returns null when the Course does not exist.
   */
  findById(id: CourseId): Promise<Course | null>;

  /**
   * Determines whether a Course exists.
   */
  exists(id: CourseId): Promise<boolean>;

  /**
   * Persists the current state of a Course aggregate.
   *
   * The implementation is responsible for deciding whether this represents
   * an insert or update based on its persistence strategy.
   */
  save(course: Course): Promise<void>;
}