/**
 * Machine-readable infrastructure error codes exposed by
 * Prisma-backed repositories.
 *
 * These codes intentionally belong to the infrastructure layer.
 * They must not leak Prisma-specific error codes into the domain.
 */
export const PrismaRepositoryErrorCode = {
  UNIQUE_CONSTRAINT:
    'PRISMA_REPOSITORY_UNIQUE_CONSTRAINT',

  FOREIGN_KEY_CONSTRAINT:
    'PRISMA_REPOSITORY_FOREIGN_KEY_CONSTRAINT',

  RECORD_NOT_FOUND:
    'PRISMA_REPOSITORY_RECORD_NOT_FOUND',

  PERSISTENCE_FAILURE:
    'PRISMA_REPOSITORY_PERSISTENCE_FAILURE',
} as const;

export type PrismaRepositoryErrorCode =
  (typeof PrismaRepositoryErrorCode)[keyof typeof PrismaRepositoryErrorCode];

/**
 * Base error for failures occurring while a repository
 * communicates with Prisma-backed persistence.
 *
 * The application layer may translate this error into an
 * application/transport-specific error without coupling the
 * rest of the system to Prisma.
 */
export class PrismaRepositoryError extends Error {
  readonly code: PrismaRepositoryErrorCode;

  readonly prismaCode: string | null;

  constructor(
    message: string,
    code: PrismaRepositoryErrorCode,
    options?: {
      cause?: unknown;
      prismaCode?: string | null;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });

    this.name = 'PrismaRepositoryError';
    this.code = code;
    this.prismaCode =
      options?.prismaCode ?? null;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}