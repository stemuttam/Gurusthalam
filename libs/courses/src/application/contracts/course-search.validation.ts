import { z } from 'zod';

import { paginationSchema } from '@gurusthalam/validation';

import { CourseLevel } from '../../domain/enums/course-level.js';
import { CourseStatus } from '../../domain/enums/course-status.js';
import { CourseType } from '../../domain/enums/course-type.js';
import { CourseVisibility } from '../../domain/enums/course-visibility.js';

import { COURSE_SEARCH_SORT_FIELDS } from './course-search.contracts.js';

/**
 * Runtime validation contract for Course search.
 *
 * Search input is intentionally validated at the application boundary.
 * Domain entities and persistence implementations remain responsible
 * for their own invariants and execution semantics.
 *
 * Pagination defaults and limits are inherited from the shared
 * pagination contract.
 */
export const courseSearchInputSchema = z
  .object({
    query: z.string().trim().min(1).optional(),

    status: z.enum(CourseStatus).optional(),

    visibility: z.enum(CourseVisibility).optional(),

    level: z.enum(CourseLevel).optional(),

    type: z.enum(CourseType).optional(),

    instructorId: z.string().trim().min(1).optional(),

    ...paginationSchema.shape,

    sortBy: z.enum(COURSE_SEARCH_SORT_FIELDS).optional(),
  })
  .strict();

/**
 * Runtime-validated Course search input type.
 */
export type CourseSearchInputSchema = z.infer<typeof courseSearchInputSchema>;
