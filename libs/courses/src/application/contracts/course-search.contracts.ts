import type { PaginationRequest } from '@gurusthalam/types';

import type { CourseLevel as CourseLevelValue } from '../../domain/enums/course-level.js';
import type { CourseStatus as CourseStatusValue } from '../../domain/enums/course-status.js';
import type { CourseType as CourseTypeValue } from '../../domain/enums/course-type.js';
import type { CourseVisibility as CourseVisibilityValue } from '../../domain/enums/course-visibility.js';

/**
 * Fields that may be used to order Course search results.
 *
 * These are application/domain vocabulary rather than database column
 * names or Prisma-specific ordering expressions.
 */
export const COURSE_SEARCH_SORT_FIELDS = [
  'title',
  'status',
  'level',
  'type',
  'visibility',
  'createdAt',
  'updatedAt',
] as const;

export type CourseSearchSortField = (typeof COURSE_SEARCH_SORT_FIELDS)[number];

/**
 * Filters supported by the Course search contract.
 *
 * This contract describes search semantics without prescribing how
 * persistence performs the search.
 *
 * It intentionally contains no:
 * - Prisma types;
 * - SQL expressions;
 * - database operators;
 * - HTTP DTOs;
 * - NestJS dependencies;
 * - read-model implementation details.
 */
export interface CourseSearchCriteria {
  /**
   * Optional normalized free-text search term.
   *
   * The exact persistence-level matching strategy remains an
   * infrastructure/query concern.
   */
  readonly query?: string;

  readonly status?: CourseStatusValue;

  readonly visibility?: CourseVisibilityValue;

  readonly level?: CourseLevelValue;

  readonly type?: CourseTypeValue;

  /**
   * Filters by the Course's instructor identity.
   *
   * This remains distinct from CourseOwnership.
   */
  readonly instructorId?: string;
}

/**
 * Application-level Course search request.
 *
 * Pagination primitives are reused from the shared types package.
 *
 * The sort field is narrowed to the explicit Course search vocabulary
 * instead of accepting arbitrary database field names.
 */
export interface CourseSearchRequest
  extends
    CourseSearchCriteria,
    Pick<PaginationRequest, 'page' | 'limit' | 'sortOrder'> {
  readonly sortBy?: CourseSearchSortField;
}

/**
 * Runtime-validated Course search input.
 *
 * This represents the shape accepted by the application boundary.
 * Runtime validation is performed by courseSearchInputSchema.
 */
export type CourseSearchInput = CourseSearchRequest;
