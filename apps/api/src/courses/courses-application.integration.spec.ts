import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  Test,
} from '@nestjs/testing';

import {
  Course,
  CourseLevel,
  CourseType,
  CourseVisibility,
  DefaultCourseApplicationService,
  type CourseRepository,
} from '@gurusthalam/courses';

import {
  COURSE_REPOSITORY,
} from '../database/prisma/repositories/courses/courses-repository.tokens.js';


class InMemoryCourseRepository
  implements CourseRepository {
  private readonly courses =
    new Map<string, Course>();

  async findById(
    id: Course['id'],
  ): Promise<Course | null> {
    return (
      this.courses.get(
        id.toString(),
      ) ?? null
    );
  }

  async exists(
    id: Course['id'],
  ): Promise<boolean> {
    return this.courses.has(
      id.toString(),
    );
  }

  async save(
    course: Course,
  ): Promise<void> {
    this.courses.set(
      course.id.toString(),
      course,
    );
  }
}


describe(
  'Course application integration',
  () => {
    const createTestingModule =
      async () => {
        const repository =
          new InMemoryCourseRepository();

        const moduleRef =
          await Test
            .createTestingModule({
              imports: [],
              providers: [
                {
                  provide:
                    DefaultCourseApplicationService,

                  inject: [
                    COURSE_REPOSITORY,
                  ],

                  useFactory: (
                    courseRepository:
                      CourseRepository,
                  ) =>
                    new DefaultCourseApplicationService(
                      courseRepository,
                    ),
                },
                {
                  provide:
                    COURSE_REPOSITORY,

                  useValue:
                    repository,
                },
              ],
            })
            .compile();

        return moduleRef;
      };


    it(
      'resolves the application service through Nest DI',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        expect(
          service,
        ).toBeInstanceOf(
          DefaultCourseApplicationService,
        );

        await moduleRef.close();
      },
    );


    it(
      'creates and persists a Course through the application boundary',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const course =
          await service.createCourse({
            title:
              'Introduction to Physics',

            description:
              'Learn the fundamentals of physics.',

            level:
              CourseLevel.BEGINNER,

            type:
              CourseType.SELF_PACED,

            visibility:
              CourseVisibility.PRIVATE,

            instructorId:
              'instructor-123',
          });

        const stored =
          await service.getCourse({
            courseId:
              course.id.toString(),
          });

        expect(
          stored,
        ).toBe(course);

        expect(
          stored?.title,
        ).toBe(
          'Introduction to Physics',
        );

        await moduleRef.close();
      },
    );


    it(
      'makes a newly created Course observable through the repository boundary',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const course =
          await service.createCourse({
            title:
              'Advanced Mathematics',

            level:
              CourseLevel.ADVANCED,

            type:
              CourseType.SELF_PACED,

            instructorId:
              'instructor-456',
          });

        const exists =
          await service.courseExists({
            courseId:
              course.id.toString(),
          });

        expect(
          exists,
        ).toBe(true);

        await moduleRef.close();
      },
    );


    it(
      'preserves the Course domain event across the application boundary',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const course =
          await service.createCourse({
            title:
              'Physics Fundamentals',

            level:
              CourseLevel.BEGINNER,

            type:
              CourseType.SELF_PACED,

            instructorId:
              'instructor-789',
          });

        const events =
          course.getDomainEvents();

        expect(
          events,
        ).toHaveLength(1);

        expect(
          events[0]?.eventName,
        ).toBe(
          'courses.course.created',
        );

        expect(
          events[0]?.aggregateId,
        ).toBe(
          course.id.toString(),
        );

        await moduleRef.close();
      },
    );


    it(
      'returns false for a Course that does not exist',
      async () => {
        const moduleRef =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const exists =
          await service.courseExists({
            courseId:
              '00000000-0000-4000-8000-000000000000',
          });

        expect(
          exists,
        ).toBe(false);

        await moduleRef.close();
      },
    );
  },
);