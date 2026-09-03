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

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import {
  PrismaCourseRepository,
} from './prisma-course.repository.js';

describe(
  'PrismaCourseRepository persistence failures',
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

    const resetMocks =
      (): void => {
        findUnique.mockReset();
        upsert.mockReset();
      };

    it(
      'translates a unique constraint failure from findById',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2002',
          message:
            'Unique constraint failed',
        };

        findUnique.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.findById(
            courseId,
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,

          prismaCode:
            'P2002',

          cause:
            prismaError,
        });

        expect(
          findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'translates a foreign-key constraint failure from save',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2003',
          message:
            'Foreign key constraint failed',
        };

        upsert.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.save(
            createCourse(),
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,

          prismaCode:
            'P2003',

          cause:
            prismaError,
        });

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'translates a record-not-found failure from save',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2025',
          message:
            'Record not found',
        };

        upsert.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.save(
            createCourse(),
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.RECORD_NOT_FOUND,

          prismaCode:
            'P2025',

          cause:
            prismaError,
        });
      },
    );

    it(
      'translates unknown persistence failures from exists',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2034',
          message:
            'Transaction failed due to a write conflict',
        };

        findUnique.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.exists(
            courseId,
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,

          prismaCode:
            'P2034',

          cause:
            prismaError,
        });
      },
    );

    it(
      'preserves non-Prisma failures as persistence failures',
      async () => {
        resetMocks();

        const originalError =
          new Error(
            'Database connection closed',
          );

        findUnique.mockRejectedValue(
          originalError,
        );

        await expect(
          repository.findById(
            courseId,
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,

          prismaCode:
            null,

          cause:
            originalError,
        });
      },
    );

    it(
      'does not execute a second Prisma operation after a failure',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2002',
          message:
            'Unique constraint failed',
        };

        upsert.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.save(
            createCourse(),
          ),
        ).rejects.toBeInstanceOf(
          PrismaRepositoryError,
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