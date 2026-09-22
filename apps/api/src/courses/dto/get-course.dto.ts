/**
 * HTTP transport contract for retrieving one Course.
 *
 * The identifier is supplied through the route parameter by the
 * Course controller.
 */
export interface GetCourseDto {
  readonly courseId: string;
}
