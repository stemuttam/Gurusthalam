import type { Course } from '../../domain/entities/course.js';
import type { CourseLevel } from '../../domain/enums/course-level.js';
import type { CourseType } from '../../domain/enums/course-type.js';
import type { CourseVisibility } from '../../domain/enums/course-visibility.js';

export interface CreateCourseInput {
  readonly title: string;
  readonly description?: string | null;
  readonly level: CourseLevel;
  readonly type: CourseType;
  readonly visibility?: CourseVisibility;
  readonly instructorId: string;
}

export interface GetCourseInput {
  readonly courseId: string;
}

export interface SaveCourseInput {
  readonly course: Course;
}

export interface CourseApplicationService {
  createCourse(input: CreateCourseInput): Promise<Course>;

  getCourse(input: GetCourseInput): Promise<Course | null>;

  courseExists(input: GetCourseInput): Promise<boolean>;

  saveCourse(input: SaveCourseInput): Promise<void>;
}