/**
 * HTTP transport contract for publishing an existing CourseVersion.
 *
 * courseVersionId is supplied by the route parameter.
 *
 * Publication readiness and lifecycle state remain owned by the
 * CourseVersion domain entity.
 */
export type PublishCourseVersionDto = Record<string, never>;
