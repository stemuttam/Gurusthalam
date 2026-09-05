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
  'Course persistence event boundary integration',
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

        return {
          moduleRef,
          repository,
        };
      };


    it(
      'preserves pending domain events when a Course is persisted',
      async () => {
        const {
          moduleRef,
          repository,
        } =
          await createTestingModule();

        const course =
          Course.create({
            title:
              'Physics Fundamentals',

            description:
              'Introduction to core physics concepts.',

            level:
              CourseLevel.BEGINNER,

            type:
              CourseType.SELF_PACED,

            visibility:
              CourseVisibility.PRIVATE,

            instructorId:
              'instructor-001',
          });

        const eventsBeforeSave =
          course.getDomainEvents();

        expect(
          eventsBeforeSave,
        ).toHaveLength(1);

        await repository.save(
          course,
        );

        const eventsAfterSave =
          course.getDomainEvents();

        expect(
          eventsAfterSave,
        ).toHaveLength(1);

        expect(
          eventsAfterSave[0]?.eventId,
        ).toBe(
          eventsBeforeSave[0]?.eventId,
        );

        expect(
          eventsAfterSave[0]?.eventName,
        ).toBe(
          eventsBeforeSave[0]?.eventName,
        );

        expect(
          eventsAfterSave[0]?.aggregateId,
        ).toBe(
          course.id.toString(),
        );

        await moduleRef.close();
      },
    );


    it(
      'does not consume domain events when the Course is read back',
      async () => {
        const {
          moduleRef,
          repository,
        } =
          await createTestingModule();

        const course =
          Course.create({
            title:
              'Advanced Mathematics',

            level:
              CourseLevel.ADVANCED,

            type:
              CourseType.SELF_PACED,

            instructorId:
              'instructor-002',
          });

        await repository.save(
          course,
        );

        const stored =
          await repository.findById(
            course.id,
          );

        expect(
          stored,
        ).not.toBeNull();

        if (stored === null) {
          throw new Error(
            'Expected the persisted Course to be found.',
          );
        }

        expect(
          stored,
        ).toBe(course);

        const events =
          stored.getDomainEvents();

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
      'keeps the event collection unchanged across repeated persistence operations',
      async () => {
        const {
          moduleRef,
          repository,
        } =
          await createTestingModule();

        const course =
          Course.create({
            title:
              'Chemistry Fundamentals',

            level:
              CourseLevel.BEGINNER,

            type:
              CourseType.SELF_PACED,

            instructorId:
              'instructor-003',
          });

        const eventId =
          course
            .getDomainEvents()[0]
            ?.eventId;

        await repository.save(
          course,
        );

        await repository.save(
          course,
        );

        const events =
          course.getDomainEvents();

        expect(
          events,
        ).toHaveLength(1);

        expect(
          events[0]?.eventId,
        ).toBe(
          eventId,
        );

        await moduleRef.close();
      },
    );


    it(
      'keeps domain events available after application-level persistence',
      async () => {
        const {
          moduleRef,
        } =
          await createTestingModule();

        const service =
          moduleRef.get(
            DefaultCourseApplicationService,
          );

        const course =
          await service.createCourse({
            title:
              'Biology Fundamentals',

            level:
              CourseLevel.BEGINNER,

            type:
              CourseType.SELF_PACED,

            visibility:
              CourseVisibility.PRIVATE,

            instructorId:
              'instructor-004',
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
  },
);