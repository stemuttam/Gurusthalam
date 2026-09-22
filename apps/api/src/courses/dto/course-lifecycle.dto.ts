/**
 * Course lifecycle HTTP commands intentionally contain no JSON body.
 *
 * The Course identifier is supplied through the route parameter.
 *
 * Authentication and authorization are deliberately absent from
 * the transport contract. Those concerns belong to the API security
 * boundary and will be introduced during the dedicated authorization
 * checkpoint.
 */

/**
 * Submit a Course for review.
 */
export type SubmitCourseForReviewDto = Record<string, never>;

/**
 * Request changes on a Course currently in review.
 */
export type RequestCourseChangesDto = Record<string, never>;

/**
 * Publish a Course.
 */
export type PublishCourseDto = Record<string, never>;

/**
 * Unpublish a Course.
 */
export type UnpublishCourseDto = Record<string, never>;

/**
 * Archive a Course.
 */
export type ArchiveCourseDto = Record<string, never>;
