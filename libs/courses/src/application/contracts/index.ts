export type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
} from './course-application.contracts.js';

export {
  courseIdInputSchema,
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
} from './course-application.validation.js';

export type {
  CourseExistsInputSchema,
  CreateCourseInputSchema,
  GetCourseInputSchema,
} from './course-application.validation.js';