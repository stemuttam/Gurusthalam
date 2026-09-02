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

import type {
  PrismaCourseVersionPersistence,
} from '../../mappers/courses/index.js';

import {
  PrismaCourseVersionRepository,
} from './prisma-course-version.repository.js';

describe(
  'PrismaCourseVersionRepository',
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

    /**
     * Explicitly typed against the mapper persistence contract.
     *
     * This ensures the repository test remains coupled to the actual
     * persistence boundary rather than the mapper implementation's
     * inferred return type.
     */
    const record =
      (): PrismaCourseVersionPersistence => ({
        id:
          'course-version-001',

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
      'finds a CourseVersion by identifier and rehydrates it',
      async () => {
        resetMocks();

        const persistence =
          record();

        findUnique.mockResolvedValue(
          persistence,
        );

        const result =
          await repository.findById(
            versionId,
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
              'course-version-001',
          },
        });

        expect(
          result,
        ).toBeInstanceOf(
          CourseVersion,
        );

        expect(
          result?.id.value,
        ).toBe(
          'course-version-001',
        );

        expect(
          result?.courseId,
        ).toBe(
          'course-001',
        );

        expect(
          result?.version,
        ).toBe(
          2,
        );

        expect(
          result?.status,
        ).toBe(
          'DRAFT',
        );

        expect(
          result?.title,
        ).toBe(
          'TypeScript Fundamentals v2',
        );

        expect(
          result?.description,
        ).toBe(
          'Second version of the course.',
        );

        expect(
          result?.publishedAt,
        ).toBeNull();
      },
    );

    it(
      'returns null when the CourseVersion does not exist',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue(
          null,
        );

        await expect(
          repository.findById(
            versionId,
          ),
        ).resolves.toBeNull();

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'course-version-001',
          },
        });
      },
    );

    it(
      'finds the latest version by descending version number',
      async () => {
        resetMocks();

        findFirst.mockResolvedValue(
          record(),
        );

        const result =
          await repository.findLatestByCourseId(
            courseId,
          );

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            courseId:
              'course-001',
          },

          orderBy: {
            version:
              'desc',
          },
        });

        expect(
          result,
        ).toBeInstanceOf(
          CourseVersion,
        );

        expect(
          result?.version,
        ).toBe(
          2,
        );
      },
    );

    it(
      'returns null when a Course has no versions',
      async () => {
        resetMocks();

        findFirst.mockResolvedValue(
          null,
        );

        await expect(
          repository.findLatestByCourseId(
            courseId,
          ),
        ).resolves.toBeNull();

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            courseId:
              'course-001',
          },

          orderBy: {
            version:
              'desc',
          },
        });
      },
    );

    it(
      'finds the published version by status and descending version',
      async () => {
        resetMocks();

        const publishedRecord:
          PrismaCourseVersionPersistence =
          {
            ...record(),

            status:
              'PUBLISHED',

            publishedAt:
              new Date(
                '2026-02-01T10:00:00.000Z',
              ),
          };

        findFirst.mockResolvedValue(
          publishedRecord,
        );

        const result =
          await repository.findPublishedByCourseId(
            courseId,
          );

        expect(
          findFirst,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            courseId:
              'course-001',

            status:
              'PUBLISHED',
          },

          orderBy: {
            version:
              'desc',
          },
        });

        expect(
          result,
        ).toBeInstanceOf(
          CourseVersion,
        );

        expect(
          result?.status,
        ).toBe(
          'PUBLISHED',
        );

        expect(
          result?.version,
        ).toBe(
          2,
        );

        expect(
          result?.publishedAt,
        ).toEqual(
          new Date(
            '2026-02-01T10:00:00.000Z',
          ),
        );
      },
    );

    it(
      'returns null when no published version exists',
      async () => {
        resetMocks();

        findFirst.mockResolvedValue(
          null,
        );

        await expect(
          repository.findPublishedByCourseId(
            courseId,
          ),
        ).resolves.toBeNull();

        expect(
          findFirst,
        ).toHaveBeenCalledWith({
          where: {
            courseId:
              'course-001',

            status:
              'PUBLISHED',
          },

          orderBy: {
            version:
              'desc',
          },
        });
      },
    );

    it(
      'checks version existence using the composite unique key',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue({
          id:
            'course-version-001',
        });

        await expect(
          repository.existsByCourseIdAndVersion(
            courseId,
            2,
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
            courseId_version: {
              courseId:
                'course-001',

              version:
                2,
            },
          },

          select: {
            id:
              true,
          },
        });
      },
    );

    it(
      'returns false when the requested version does not exist',
      async () => {
        resetMocks();

        findUnique.mockResolvedValue(
          null,
        );

        await expect(
          repository.existsByCourseIdAndVersion(
            courseId,
            99,
          ),
        ).resolves.toBe(
          false,
        );

        expect(
          findUnique,
        ).toHaveBeenCalledWith({
          where: {
            courseId_version: {
              courseId:
                'course-001',

              version:
                99,
            },
          },

          select: {
            id:
              true,
          },
        });
      },
    );

    it(
      'persists a CourseVersion through upsert',
      async () => {
        resetMocks();

        const courseVersion =
          createCourseVersion();

        upsert.mockResolvedValue(
          record(),
        );

        await expect(
          repository.save(
            courseVersion,
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
              'course-version-001',
          },

          create: {
            id:
              'course-version-001',

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
          },

          update: {
            status:
              'DRAFT',

            title:
              'TypeScript Fundamentals v2',

            description:
              'Second version of the course.',

            updatedAt:
              new Date(
                '2026-01-02T10:00:00.000Z',
              ),

            publishedAt:
              null,
          },
        });
      },
    );

    it(
      'uses the CourseVersion aggregate identifier as the upsert key',
      async () => {
        resetMocks();

        const courseVersion =
          createCourseVersion();

        upsert.mockResolvedValue(
          record(),
        );

        await repository.save(
          courseVersion,
        );

        const call =
          upsert.mock.calls[0]?.[0];

        expect(
          call?.where,
        ).toEqual({
          id:
            versionId.value,
        });
      },
    );

    it(
      'does not execute additional Prisma operations during save',
      async () => {
        resetMocks();

        const courseVersion =
          createCourseVersion();

        upsert.mockResolvedValue(
          record(),
        );

        await repository.save(
          courseVersion,
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