import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  Course,
  CourseId,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
} from '@gurusthalam/courses';

import type {
  PrismaClient,
} from '@gurusthalam/database';

import type {
  PrismaCoursePersistence,
} from '../../mappers/courses/index.js';

import {
  PrismaCourseRepository,
} from './prisma-course.repository.js';

describe(
  'PrismaCourseRepository',
  () => {
    const findUnique =
      vi.fn();

    const upsert =
      vi.fn();

    const prisma = {
      course: {
        findUnique,
        upsert,
      },
    } as unknown as PrismaClient;

    const repository =
      new PrismaCourseRepository(
        prisma,
      );

    const courseId =
      CourseId.from(
        'course-001',
      );

    const createCourse =
      (): Course =>
        Course.rehydrate({
          id:
            courseId,

          title:
            'TypeScript Fundamentals',

          description:
            'Learn TypeScript from the ground up.',

          level:
            CourseLevel.BEGINNER,

          type:
            CourseType.SELF_PACED,

          visibility:
            CourseVisibility.PUBLIC,

          status:
            CourseStatus.DRAFT,

          instructorId:
            'instructor-001',

          createdAt:
            new Date(
              '2026-01-01T10:00:00.000Z',
            ),

          updatedAt:
            new Date(
              '2026-01-01T10:00:00.000Z',
            ),
        });

    /**
     * Explicitly typed against the mapper persistence contract.
     *
     * This intentionally does not use ReturnType<typeof mapper>.
     * The test should validate that repository persistence data conforms
     * to the published persistence boundary.
     */
    const record =
      (): PrismaCoursePersistence => ({
        id:
          'course-001',

        title:
          'TypeScript Fundamentals',

        description:
          'Learn TypeScript from the ground up.',

        level:
          'BEGINNER',

        type:
          'SELF_PACED',

        visibility:
          'PUBLIC',

        status:
          'DRAFT',

        instructorId:
          'instructor-001',

        createdAt:
          new Date(
            '2026-01-01T10:00:00.000Z',
          ),

        updatedAt:
          new Date(
            '2026-01-01T10:00:00.000Z',
          ),
      });

    const resetMocks =
      (): void => {
        findUnique.mockReset();
        upsert.mockReset();
      };

    it(
      'finds a Course and rehydrates it into the domain',
      async () => {
        resetMocks();

        const persistence =
          record();

        findUnique.mockResolvedValue(
          persistence,
        );

        const result =
          await repository.findById(
            courseId,
          );

        expect(
          findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-001',
          },
        });

        expect(
          result,
        ).toBeInstanceOf(
          Course,
        );

        expect(
          result?.id.value,
        ).toBe(
          'course-001',
        );

        expect(
          result?.title,
        ).toBe(
          'TypeScript Fundamentals',
        );

        expect(
          result?.description,
        ).toBe(
          'Learn TypeScript from the ground up.',
        );

        expect(
          result?.level,
        ).toBe(
          CourseLevel.BEGINNER,
        );

        expect(
          result?.type,
        ).toBe(
          CourseType.SELF_PACED,
        );

        expect(
          result?.visibility,
        ).toBe(
          CourseVisibility.PUBLIC,
        );

        expect(
          result?.status,
        ).toBe(
          CourseStatus.DRAFT,
        );

        expect(
          result?.instructorId,
        ).toBe(
          'instructor-001',
        );
      },
    );

    it(
      'returns null when the Course does not exist',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue(
          null,
        );

        await expect(
          repository.findById(
            courseId,
          ),
        ).resolves.toBeNull();

        expect(
          findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-001',
          },
        });
      },
    );

    it(
      'checks Course existence using an id-only projection',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue({
          id:
            'course-001',
        });

        await expect(
          repository.exists(
            courseId,
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-001',
          },

          select: {
            id:
              true,
          },
        });
      },
    );

    it(
      'returns false when the Course does not exist',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue(
          null,
        );

        await expect(
          repository.exists(
            courseId,
          ),
        ).resolves.toBe(
          false,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-001',
          },

          select: {
            id:
              true,
          },
        });
      },
    );

    it(
      'persists a Course through upsert',
      async () => {
        resetMocks();

        const course =
          createCourse();

        upsert.mockResolvedValue(
          record(),
        );

        await expect(
          repository.save(
            course,
          ),
        ).resolves.toBeUndefined();

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          upsert,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-001',
          },

          create: {
            id:
              'course-001',

            title:
              'TypeScript Fundamentals',

            description:
              'Learn TypeScript from the ground up.',

            level:
              'BEGINNER',

            type:
              'SELF_PACED',

            visibility:
              'PUBLIC',

            status:
              'DRAFT',

            instructorId:
              'instructor-001',

            createdAt:
              new Date(
                '2026-01-01T10:00:00.000Z',
              ),

            updatedAt:
              new Date(
                '2026-01-01T10:00:00.000Z',
              ),
          },

          update: {
            title:
              'TypeScript Fundamentals',

            description:
              'Learn TypeScript from the ground up.',

            level:
              'BEGINNER',

            type:
              'SELF_PACED',

            visibility:
              'PUBLIC',

            status:
              'DRAFT',

            instructorId:
              'instructor-001',

            updatedAt:
              new Date(
                '2026-01-01T10:00:00.000Z',
              ),
          },
        });
      },
    );

    it(
      'uses the Course aggregate identifier as the upsert key',
      async () => {
        resetMocks();

        const course =
          createCourse();

        upsert.mockResolvedValue(
          record(),
        );

        await repository.save(
          course,
        );

        const call =
          upsert.mock.calls[0]?.[0];

        expect(
          call?.where,
        ).toEqual({
          id:
            courseId.value,
        });
      },
    );

    it(
      'does not execute additional Prisma operations during save',
      async () => {
        resetMocks();

        const course =
          createCourse();

        upsert.mockResolvedValue(
          record(),
        );

        await repository.save(
          course,
        );

        expect(
          findUnique,
        ).not.toHaveBeenCalled();

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);