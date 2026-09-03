import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  mapPrismaRepositoryError,
  withPrismaRepositoryErrorBoundary,
} from './prisma-repository-error.mapper.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from './prisma-repository.error.js';

describe(
  'Prisma repository error mapping',
  () => {
    it(
      'maps P2002 to UNIQUE_CONSTRAINT',
      () => {
        const prismaError = {
          code: 'P2002',
          message:
            'Unique constraint failed',
        };

        const error =
          mapPrismaRepositoryError(
            prismaError,
            'CourseVersionRepository.save',
          );

        expect(error).toBeInstanceOf(
          PrismaRepositoryError,
        );

        expect(error.code).toBe(
          PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
        );

        expect(error.prismaCode).toBe(
          'P2002',
        );

        expect(error.cause).toBe(
          prismaError,
        );
      },
    );

    it(
      'maps P2003 to FOREIGN_KEY_CONSTRAINT',
      () => {
        const prismaError = {
          code: 'P2003',
          message:
            'Foreign key constraint failed',
        };

        const error =
          mapPrismaRepositoryError(
            prismaError,
            'CourseVersionRepository.save',
          );

        expect(error.code).toBe(
          PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
        );

        expect(error.prismaCode).toBe(
          'P2003',
        );

        expect(error.cause).toBe(
          prismaError,
        );
      },
    );

    it(
      'maps P2025 to RECORD_NOT_FOUND',
      () => {
        const prismaError = {
          code: 'P2025',
          message:
            'Record not found',
        };

        const error =
          mapPrismaRepositoryError(
            prismaError,
            'CourseVersionRepository.save',
          );

        expect(error.code).toBe(
          PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
        );

        expect(error.prismaCode).toBe(
          'P2025',
        );

        expect(error.cause).toBe(
          prismaError,
        );
      },
    );

    it(
      'maps unknown Prisma failures to PERSISTENCE_FAILURE',
      () => {
        const prismaError = {
          code: 'P2034',
          message:
            'Transaction failed due to a write conflict',
        };

        const error =
          mapPrismaRepositoryError(
            prismaError,
            'CourseRepository.save',
          );

        expect(error.code).toBe(
          PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
        );

        expect(error.prismaCode).toBe(
          'P2034',
        );

        expect(error.cause).toBe(
          prismaError,
        );
      },
    );

    it(
      'maps non-Prisma failures to PERSISTENCE_FAILURE',
      () => {
        const originalError =
          new Error(
            'Connection unexpectedly closed',
          );

        const error =
          mapPrismaRepositoryError(
            originalError,
            'CourseRepository.findById',
          );

        expect(error.code).toBe(
          PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
        );

        expect(error.prismaCode).toBeNull();

        expect(error.cause).toBe(
          originalError,
        );
      },
    );

    it(
      'does not double-wrap repository errors',
      () => {
        const originalError =
          new PrismaRepositoryError(
            'Already mapped',
            PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
          );

        const error =
          mapPrismaRepositoryError(
            originalError,
            'CourseRepository.save',
          );

        expect(error).toBe(
          originalError,
        );
      },
    );

    it(
      'translates failures thrown by the async boundary',
      async () => {
        const prismaError = {
          code: 'P2002',
          message:
            'Unique constraint failed',
        };

        await expect(
          withPrismaRepositoryErrorBoundary(
            'CourseRepository.save',
            async () => {
              throw prismaError;
            },
          ),
        ).rejects.toMatchObject({
          name: 'PrismaRepositoryError',
          code:
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
          prismaCode: 'P2002',
          cause: prismaError,
        });
      },
    );

    it(
      'returns successful operation values unchanged',
      async () => {
        const result =
          await withPrismaRepositoryErrorBoundary(
            'CourseRepository.findById',
            async () => 'success',
          );

        expect(result).toBe(
          'success',
        );
      },
    );
  },
);