import type {
  CourseLevel,
  CourseType,
  CourseVisibility,
} from '@gurusthalam/courses';

/**
 * HTTP transport contract for updating Course metadata.
 *
 * courseId is supplied by the route parameter and therefore is not
 * part of the JSON request body.
 *
 * At least one mutable field must be supplied. The canonical
 * application validation schema enforces that invariant.
 */
export interface UpdateCourseMetadataDto {
  readonly title?: string;

  readonly description?: string | null;

  readonly level?: CourseLevel;

  readonly type?: CourseType;

  readonly visibility?: CourseVisibility;
}
