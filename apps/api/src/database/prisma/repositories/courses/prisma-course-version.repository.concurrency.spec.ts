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
  'PrismaCourseVersionRepository concurrency guarantees',
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

    const createCourseVersion =
      (
        id: string,
        version: number,
      ): CourseVersion =>
        CourseVersion.rehydrate({
          id:
            CourseVersionId.from(
              id,
            ),

          courseId:
            courseId.value,

          version,

          status:
            'DRAFT',

          title:
            `TypeScript Fundamentals v${version}`,

          description:
            `Course version ${version}.`,

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
      'uses aggregate identity as the only save upsert key',
      async () => {
        resetMocks();

        upsert.mockResolvedValue(
          undefined,
        );

        const courseVersion =
          createCourseVersion(
            'course-version-001',
            2,
          );

        await repository.save(
          courseVersion,
        );

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          upsert.mock.calls[0]?.[0]?.where,
        ).toEqual({
          id:
            'course-version-001',
        });

        expect(
          findUnique,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not perform an existence preflight before save',
      async () => {
        resetMocks();

        upsert.mockResolvedValue(
          undefined,
        );

        await repository.save(
          createCourseVersion(
            'course-version-001',
            2,
          ),
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

    it(
      'preserves a database uniqueness conflict from concurrent logical versions',
      async () => {
        resetMocks();

        const uniqueConstraintError = {
          code:
            'P2002',

          message:
            'Unique constraint failed on the fields: (`courseId`,`version`)',
        };

        upsert
          .mockResolvedValueOnce(
            undefined,
          )
          .mockRejectedValueOnce(
            uniqueConstraintError,
          );

        const firstWrite =
          repository.save(
            createCourseVersion(
              'course-version-001',
              2,
            ),
          );

        const secondWrite =
          repository.save(
            createCourseVersion(
              'course-version-002',
              2,
            ),
          );

        await expect(
          firstWrite,
        ).resolves.toBeUndefined();

        await expect(
          secondWrite,
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,

          prismaCode:
            'P2002',

          cause:
            uniqueConstraintError,
        });

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          findUnique,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not retry a unique constraint conflict inside the repository',
      async () => {
        resetMocks();

        const uniqueConstraintError = {
          code:
            'P2002',

          message:
            'Unique constraint failed',
        };

        upsert.mockRejectedValue(
          uniqueConstraintError,
        );

        await expect(
          repository.save(
            createCourseVersion(
              'course-version-001',
              2,
            ),
          ),
        ).rejects.toBeInstanceOf(
          PrismaRepositoryError,
        );

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'does not swallow transaction conflicts',
      async () => {
        resetMocks();

        const transactionConflictError = {
          code:
            'P2034',

          message:
            'Transaction failed due to a write conflict or a deadlock',
        };

        upsert.mockRejectedValue(
          transactionConflictError,
        );

        await expect(
          repository.save(
            createCourseVersion(
              'course-version-001',
              2,
            ),
          ),
        ).rejects.toMatchObject({
          name:
            'PrismaRepositoryError',

          code:
            PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,

          prismaCode:
            'P2034',

          cause:
            transactionConflictError,
        });

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'allows concurrent saves with different aggregate identities and versions',
      async () => {
        resetMocks();

        upsert.mockImplementation(
          async () =>
            undefined,
        );

        const firstVersion =
          createCourseVersion(
            'course-version-001',
            2,
          );

        const secondVersion =
          createCourseVersion(
            'course-version-002',
            3,
          );

        await expect(
          Promise.all([
            repository.save(
              firstVersion,
            ),

            repository.save(
              secondVersion,
            ),
          ]),
        ).resolves.toEqual([
          undefined,
          undefined,
        ]);

        expect(
          upsert,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          upsert.mock.calls.map(
            (
              call,
            ) =>
              call[0]?.where,
          ),
        ).toEqual([
          {
            id:
              'course-version-001',
          },

          {
            id:
              'course-version-002',
          },
        ]);

        expect(
          findUnique,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'never performs a read after a uniqueness conflict',
      async () => {
        resetMocks();

        const uniqueConstraintError = {
          code:
            'P2002',

          message:
            'Unique constraint failed',
        };

        upsert.mockRejectedValue(
          uniqueConstraintError,
        );

        await expect(
          repository.save(
            createCourseVersion(
              'course-version-001',
              2,
            ),
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