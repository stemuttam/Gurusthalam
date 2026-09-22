/**
 * HTTP transport contract for creating the next CourseVersion.
 *
 * courseId is supplied by the route parameter.
 *
 * The application service intentionally derives the version number,
 * title, description, and status rather than accepting them from HTTP.
 */
export type CreateCourseVersionDto = Record<string, never>;
