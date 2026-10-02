import { describe, expect, it, vi } from 'vitest';

import { CourseVersion } from '../../domain/entities/course-version.js';
import { CourseVersionId } from '../../domain/value-objects/course-version-id.js';
import { COURSE_VERSION_AUDIT_ACTOR_TYPE } from '../../domain/versioning/course-version-audit.js';

import type {
  CourseVersionRollbackPersistence,
  CourseVersionRollbackTransactionContext,
} from '../contracts/course-version-rollback.contracts.js';

import { DefaultCourseVersionRollbackApplicationService } from './course-version-rollback.application.service.js';

const source = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-source'),
  courseId: 'course-001',
  version: 3,
  status: 'PUBLISHED',
  title: 'Stable Course',
  description: 'Stable historical version.',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T01:00:00.000Z'),
  publishedAt: new Date('2026-01-01T02:00:00.000Z'),
});

const latest = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-latest'),
  courseId: 'course-001',
  version: 5,
  status: 'DRAFT',
  title: 'Latest Draft',
  description: 'Latest version.',
  createdAt: new Date('2026-01-05T00:00:00.000Z'),
  updatedAt: new Date('2026-01-05T01:00:00.000Z'),
  publishedAt: null,
});

function createContext(): {
  context: CourseVersionRollbackTransactionContext;
  findVersionById: ReturnType<typeof vi.fn>;
  findLatestVersionByCourseId: ReturnType<typeof vi.fn>;
  saveVersion: ReturnType<typeof vi.fn>;
  appendLineage: ReturnType<typeof vi.fn>;
  appendAudit: ReturnType<typeof vi.fn>;
} {
  const findVersionById = vi.fn();

  const findLatestVersionByCourseId = vi.fn();

  const saveVersion = vi.fn().mockResolvedValue(undefined);

  const appendLineage = vi.fn().mockResolvedValue(undefined);

  const appendAudit = vi.fn().mockResolvedValue(undefined);

  return {
    context: {
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    },
    findVersionById,
    findLatestVersionByCourseId,
    saveVersion,
    appendLineage,
    appendAudit,
  };
}

function createPersistence(
  context: CourseVersionRollbackTransactionContext,
  execute?: CourseVersionRollbackPersistence['execute'],
): CourseVersionRollbackPersistence {
  return {
    execute:
      execute ??
      (async <T>(
        work: (
          transaction: CourseVersionRollbackTransactionContext,
        ) => Promise<T>,
      ): Promise<T> => work(context)),
  };
}

const validInput = {
  courseId: 'course-001',
  sourceVersionId: 'course-version-source',
  reason: 'Restore stable published content.',
  actor: {
    type: COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,
    id: 'rollback-system',
  },
};

describe('DefaultCourseVersionRollbackApplicationService failure semantics', () => {
  it('does not enter the transaction when application validation fails', async () => {
    const { context } = createContext();

    let executeCalls = 0;

    const execute: CourseVersionRollbackPersistence['execute'] = async <T>(
      work: (
        transaction: CourseVersionRollbackTransactionContext,
      ) => Promise<T>,
    ): Promise<T> => {
      executeCalls += 1;

      return work(context);
    };

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context, execute),
    );

    await expect(
      service.rollback({
        ...validInput,
        courseId: '   ',
      }),
    ).rejects.toThrow();

    expect(executeCalls).toBe(0);
  });

  it('does not query the latest version when the source is missing', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    findVersionById.mockResolvedValue(null);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toThrow(
      'CourseVersion rollback source was not found.',
    );

    expect(findLatestVersionByCourseId).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
    expect(appendLineage).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('does not write when the source belongs to another Course', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    findVersionById.mockResolvedValue({
      ...source,
      courseId: 'course-other',
    });

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toThrow(
      'CourseVersion rollback source does not belong to the specified Course.',
    );

    expect(findLatestVersionByCourseId).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
    expect(appendLineage).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('propagates latest-version lookup failures without writing', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    const error = new Error('Latest version lookup failed.');

    findVersionById.mockResolvedValue(source);
    findLatestVersionByCourseId.mockRejectedValue(error);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toBe(error);

    expect(saveVersion).not.toHaveBeenCalled();
    expect(appendLineage).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('propagates version persistence failure before lineage or audit writes', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    const error = new Error('Rollback version persistence failed.');

    findVersionById.mockResolvedValue(source);
    findLatestVersionByCourseId.mockResolvedValue(latest);
    saveVersion.mockRejectedValue(error);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toBe(error);

    expect(saveVersion).toHaveBeenCalledTimes(1);
    expect(appendLineage).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('propagates lineage persistence failure before audit persistence', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    const error = new Error('Rollback lineage persistence failed.');

    findVersionById.mockResolvedValue(source);
    findLatestVersionByCourseId.mockResolvedValue(latest);
    appendLineage.mockRejectedValue(error);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toBe(error);

    expect(saveVersion).toHaveBeenCalledTimes(1);
    expect(appendLineage).toHaveBeenCalledTimes(1);
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it('propagates audit persistence failure after version and lineage persistence', async () => {
    const {
      context,
      findVersionById,
      findLatestVersionByCourseId,
      saveVersion,
      appendLineage,
      appendAudit,
    } = createContext();

    const error = new Error('Rollback audit persistence failed.');

    findVersionById.mockResolvedValue(source);
    findLatestVersionByCourseId.mockResolvedValue(latest);
    appendAudit.mockRejectedValue(error);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    await expect(service.rollback(validInput)).rejects.toBe(error);

    expect(saveVersion).toHaveBeenCalledTimes(1);
    expect(appendLineage).toHaveBeenCalledTimes(1);
    expect(appendAudit).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction-executor failures without translating them', async () => {
    const { context } = createContext();

    const error = new Error('Transaction infrastructure failure.');

    let executeCalls = 0;

    const execute: CourseVersionRollbackPersistence['execute'] = async <T>(
      work: (
        transaction: CourseVersionRollbackTransactionContext,
      ) => Promise<T>,
    ): Promise<T> => {
      executeCalls += 1;

      void work;

      throw error;
    };

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context, execute),
    );

    await expect(service.rollback(validInput)).rejects.toBe(error);

    expect(executeCalls).toBe(1);
  });

  it('returns a frozen application result after successful persistence', async () => {
    const { context, findVersionById, findLatestVersionByCourseId } =
      createContext();

    findVersionById.mockResolvedValue(source);
    findLatestVersionByCourseId.mockResolvedValue(latest);

    const service = new DefaultCourseVersionRollbackApplicationService(
      createPersistence(context),
    );

    const result = await service.rollback(validInput);

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.version.courseId).toBe('course-001');
    expect(result.version.version).toBe(6);
    expect(result.lineage.sourceVersion).toBe(3);
    expect(result.lineage.targetVersion).toBe(6);
    expect(result.audit.actor.type).toBe(
      COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,
    );
  });
});
