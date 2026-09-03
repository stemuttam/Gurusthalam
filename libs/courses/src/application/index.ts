export type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
} from './contracts/index.js';

export {
  courseIdInputSchema,
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
} from './contracts/index.js';

export type {
  CourseExistsInputSchema,
  CreateCourseInputSchema,
  GetCourseInputSchema,
} from './contracts/index.js';

export {
  DefaultCourseApplicationService,
} from './services/index.js';