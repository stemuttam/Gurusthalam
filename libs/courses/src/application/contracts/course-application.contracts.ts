import type { Course } from '../../domain/entities/course.js';

import type {
  CreateCourseInputSchema,
  GetCourseInputSchema,
} from './course-application.validation.js';

export type CreateCourseInput = CreateCourseInputSchema;

export type GetCourseInput = GetCourseInputSchema;

export interface SaveCourseInput {
  readonly course: Course;
}

export interface CourseApplicationService {
  createCourse(input: CreateCourseInput): Promise<Course>;

  getCourse(input: GetCourseInput): Promise<Course | null>;

  courseExists(input: GetCourseInput): Promise<boolean>;

  saveCourse(input: SaveCourseInput): Promise<void>;
}