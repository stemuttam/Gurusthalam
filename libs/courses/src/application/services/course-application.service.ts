import { Course } from '../../domain/entities/course.js';
import type { CourseRepository } from '../../domain/repositories/course-repository.js';
import { CourseId } from '../../domain/value-objects/course-id.js';
import type {
  CourseApplicationService,
  CreateCourseInput,
  GetCourseInput,
  SaveCourseInput,
} from '../contracts/course-application.contracts.js';

export class DefaultCourseApplicationService
  implements CourseApplicationService
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async createCourse(input: CreateCourseInput): Promise<Course> {
    const course = Course.create({
      title: input.title,
      description: input.description ?? null,
      level: input.level,
      type: input.type,
      instructorId: input.instructorId,
      ...(input.visibility !== undefined
        ? { visibility: input.visibility }
        : {}),
    });

    await this.courseRepository.save(course);

    return course;
  }

  async getCourse(input: GetCourseInput): Promise<Course | null> {
    const courseId = this.toCourseId(input.courseId);

    return this.courseRepository.findById(courseId);
  }

  async courseExists(input: GetCourseInput): Promise<boolean> {
    const courseId = this.toCourseId(input.courseId);

    return this.courseRepository.exists(courseId);
  }

  async saveCourse(input: SaveCourseInput): Promise<void> {
    await this.courseRepository.save(input.course);
  }

  private toCourseId(value: string): CourseId {
    return CourseId.from(value);
  }
}