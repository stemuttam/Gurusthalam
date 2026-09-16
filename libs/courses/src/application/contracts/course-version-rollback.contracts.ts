import type {
  CourseVersionAudit,
  CourseVersionAuditActor,
} from '../../domain/versioning/course-version-audit.js';

import type {
  CourseVersionLineage,
} from '../../domain/versioning/course-version-lineage.js';

import type {
  CourseVersion,
} from '../../domain/entities/course-version.js';

import type {
  CourseId,
} from '../../domain/value-objects/course-id.js';

import type {
  CourseVersionId,
} from '../../domain/value-objects/course-version-id.js';

export interface CourseVersionRollbackInput {
  readonly courseId: string;
  readonly sourceVersionId: string;
  readonly reason: string;
  readonly actor: CourseVersionAuditActor;
}

export interface CourseVersionRollbackApplicationResult {
  readonly version: CourseVersion;
  readonly lineage: CourseVersionLineage;
  readonly audit: CourseVersionAudit;
}

/**
 * Transaction-scoped persistence operations required by the rollback
 * application use case.
 *
 * These operations intentionally expose domain objects rather than
 * Prisma-specific persistence types.
 */
export interface CourseVersionRollbackTransactionContext {
  findVersionById(
    id: CourseVersionId,
  ): Promise<CourseVersion | null>;

  findLatestVersionByCourseId(
    courseId: CourseId,
  ): Promise<CourseVersion | null>;

  saveVersion(
    version: CourseVersion,
  ): Promise<void>;

  appendLineage(
    lineage: CourseVersionLineage,
  ): Promise<void>;

  appendAudit(
    audit: CourseVersionAudit,
  ): Promise<void>;
}

/**
 * Transaction boundary for CourseVersion rollback.
 *
 * The implementation owns the actual database transaction.
 * The application layer supplies only the domain-level work.
 */
export interface CourseVersionRollbackPersistence {
  execute<T>(
    work: (
      context: CourseVersionRollbackTransactionContext,
    ) => Promise<T>,
  ): Promise<T>;
}

/**
 * Application service boundary for transactional CourseVersion rollback.
 */
export interface CourseVersionRollbackApplicationService {
  rollback(
    input: CourseVersionRollbackInput,
  ): Promise<CourseVersionRollbackApplicationResult>;
}