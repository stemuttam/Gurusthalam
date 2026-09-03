import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from './prisma-repository.error.js';

interface PrismaErrorLike {
  readonly code?: unknown;
  readonly message?: unknown;
}

/**
 * Extracts a Prisma-style error code without depending on
 * Prisma's generated error class.
 *
 * This is intentional:
 *
 * - repositories should not depend on a particular Prisma
 *   runtime error class implementation;
 * - generated Prisma clients may be regenerated independently;
 * - tests can use lightweight error doubles;
 * - the repository only needs the stable structured code.
 */
const getPrismaErrorCode = (
  error: unknown,
): string | null => {
  if (
    typeof error !== 'object' ||
    error === null
  ) {
    return null;
  }

  const candidate =
    error as PrismaErrorLike;

  return typeof candidate.code === 'string'
    ? candidate.code
    : null;
};

/**
 * Returns true when the supplied value already represents
 * a repository-level persistence error.
 */
const isPrismaRepositoryError = (
  error: unknown,
): error is PrismaRepositoryError =>
  error instanceof PrismaRepositoryError;

/**
 * Translates a Prisma persistence failure into the stable
 * repository infrastructure error contract.
 *
 * Known Prisma errors receive semantic repository codes.
 * Unknown failures are preserved as the cause of a generic
 * persistence error.
 */
export const mapPrismaRepositoryError = (
  error: unknown,
  operation: string,
): PrismaRepositoryError => {
  if (
    isPrismaRepositoryError(error)
  ) {
    return error;
  }

  const prismaCode =
    getPrismaErrorCode(error);

  switch (prismaCode) {
    case 'P2002':
      return new PrismaRepositoryError(
        `A unique constraint was violated while performing repository operation "${operation}".`,
        PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
        {
          cause: error,
          prismaCode,
        },
      );

    case 'P2003':
      return new PrismaRepositoryError(
        `A foreign-key constraint was violated while performing repository operation "${operation}".`,
        PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
        {
          cause: error,
          prismaCode,
        },
      );

    case 'P2025':
      return new PrismaRepositoryError(
        `A required record was not found while performing repository operation "${operation}".`,
        PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
        {
          cause: error,
          prismaCode,
        },
      );

    default:
      return new PrismaRepositoryError(
        `Prisma persistence failed while performing repository operation "${operation}".`,
        PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
        {
          cause: error,
          prismaCode,
        },
      );
  }
};

/**
 * Executes a repository persistence operation and translates
 * Prisma failures into the repository error boundary.
 */
export const withPrismaRepositoryErrorBoundary =
  async <T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      throw mapPrismaRepositoryError(
        error,
        operation,
      );
    }
  };