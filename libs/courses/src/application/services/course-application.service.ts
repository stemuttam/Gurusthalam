import { Course } from '../../domain/entities/course.js';
import type { CourseRepository } from '../../domain/repositories/course-repository.js';
import { CourseId } from '../../domain/value-objects/course-id.js';

import {
  courseExistsInputSchema,
  createCourseInputSchema,
  getCourseInputSchema,
} from '../contracts/course-application.validation.js';

import type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
} from '../contracts/course-application.contracts.js';

export class DefaultCourseApplicationService
  implements CourseApplicationService
{
  constructor(
    private readonly courseRepository: CourseRepository,
  ) {}

  async createCourse(
    input: CreateCourseInput,
  ): Promise<Course> {
    const validatedInput =
      createCourseInputSchema.parse(input);

    const course = Course.create({
      title: validatedInput.title,
      description: validatedInput.description ?? null,
      level: validatedInput.level,
      type: validatedInput.type,
      instructorId: validatedInput.instructorId,
      ...(validatedInput.visibility !== undefined
        ? {
            visibility: validatedInput.visibility,
          }
        : {}),
    });

    await this.courseRepository.save(course);

    return course;
  }

  async getCourse(
    input: GetCourseInput,
  ): Promise<Course | null> {
    const validatedInput =
      getCourseInputSchema.parse(input);

    const courseId = this.toCourseId(
      validatedInput.courseId,
    );

    return this.courseRepository.findById(courseId);
  }

  async courseExists(
    input: GetCourseInput,
  ): Promise<boolean> {
    const validatedInput =
      courseExistsInputSchema.parse(input);

    const courseId = this.toCourseId(
      validatedInput.courseId,
    );

    return this.courseRepository.exists(courseId);
  }

  async saveCourse(
    input: SaveCourseInput,
  ): Promise<void> {
    await this.courseRepository.save(input.course);
  }

  private toCourseId(value: string): CourseId {
    return CourseId.from(value);
  }
}