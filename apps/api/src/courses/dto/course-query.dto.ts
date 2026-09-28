import type { CourseQueryRequest } from '@gurusthalam/courses';

/**

* HTTP transport contract for Course discovery/query operations.
*
* The API boundary intentionally reuses the established Course query
* request vocabulary. No persistence-specific filters, SQL operators,
* or Prisma types are exposed here.
*
* Runtime validation is performed by the canonical Course query
* validation contract at the application boundary.
  */
  export type CourseQueryDto = CourseQueryRequest;