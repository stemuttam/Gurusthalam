import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CourseId,
  CourseVersion,
  CourseVersionId,
} from '@gurusthalam/courses';

import type {
  PrismaClient,
} from '@gurusthalam/database';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

import {
  PrismaCourseVersionRepository,
} from './prisma-course-version.repository.js';

describe(
  'PrismaCourseVersionRepository persistence failures',
  () => {
    const findUnique =
      vi.fn();

    const findFirst =
      vi.fn();

    const upsert =
      vi.fn();

    const prisma = {
      courseVersion: {
        findUnique,
        findFirst,
        upsert,
      },
    } as unknown as PrismaClient;

    const repository =
      new PrismaCourseVersionRepository(
        prisma,
      );

    const courseId =
      CourseId.from(
        'course-001',
      );

    const versionId =
      CourseVersionId.from(
        'course-version-001',
      );

    const createCourseVersion =
      (): CourseVersion =>
        CourseVersion.rehydrate({
          id:
            versionId,

          courseId:
            'course-001',

          version:
            2,

          status:
            'DRAFT',

          title:
            'TypeScript Fundamentals v2',

          description:
            'Second version of the course.',

          createdAt:
            new Date(
              '2026-01-02T10:00:00.000Z',
            ),

          updatedAt:
            new Date(
              '2026-01-02T10:00:00.000Z',
            ),

          publishedAt:
            null,
        });

    const resetMocks =
      (): void => {
        findUnique.mockReset();
        findFirst.mockReset();
        upsert.mockReset();
      };

    it(
      'translates a unique constraint failure from save',
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
            createCourseVersion(),
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
          upsert,
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
            createCourseVersion(),
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
      },
    );

    it(
      'translates a record-not-found failure from findById',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2025',
          message:
            'Record not found',
        };

        findUnique.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.findById(
            versionId,
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

        expect(
          findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'translates unknown persistence failures from latest-version lookup',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2034',
          message:
            'Transaction failed due to a write conflict',
        };

        findFirst.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.findLatestByCourseId(
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
      'translates unknown persistence failures from published-version lookup',
      async () => {
        resetMocks();

        const prismaError = {
          code: 'P2010',
          message:
            'Raw query failed',
        };

        findFirst.mockRejectedValue(
          prismaError,
        );

        await expect(
          repository.findPublishedByCourseId(
            courseId,
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,

          prismaCode:
            'P2010',

          cause:
            prismaError,
        });
      },
    );

    it(
      'translates non-Prisma failures from version existence lookup',
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
          repository.existsByCourseIdAndVersion(
            courseId,
            2,
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
      'does not execute another Prisma operation after a failed save',
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
            createCourseVersion(),
          ),
        ).rejects.toBeInstanceOf(
          PrismaRepositoryError,
        );

        expect(
          findUnique,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
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