import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CourseVersion,
} from '../../domain/entities/course-version.js';

import {
  CourseVersionId,
} from '../../domain/value-objects/course-version-id.js';

import {
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
} from '../../domain/versioning/course-version-audit.js';

import {
  COURSE_VERSION_LINEAGE_RELATION,
} from '../../domain/versioning/course-version-lineage.js';

import type {
  CourseVersionRollbackPersistence,
  CourseVersionRollbackTransactionContext,
} from '../contracts/course-version-rollback.contracts.js';

import {
  DefaultCourseVersionRollbackApplicationService,
} from './course-version-rollback.application.service.js';

const source =
  CourseVersion.rehydrate({
    id:
      CourseVersionId.from(
        'course-version-source',
      ),

    courseId:
      'course-001',

    version:
      3,

    status:
      'PUBLISHED',

    title:
      'Stable Course',

    description:
      'Stable historical version.',

    createdAt:
      new Date(
        '2026-01-01T00:00:00.000Z',
      ),

    updatedAt:
      new Date(
        '2026-01-01T01:00:00.000Z',
      ),

    publishedAt:
      new Date(
        '2026-01-01T02:00:00.000Z',
      ),
  });

const latest =
  CourseVersion.rehydrate({
    id:
      CourseVersionId.from(
        'course-version-latest',
      ),

    courseId:
      'course-001',

    version:
      5,

    status:
      'DRAFT',

    title:
      'Latest Draft',

    description:
      'Latest version.',

    createdAt:
      new Date(
        '2026-01-05T00:00:00.000Z',
      ),

    updatedAt:
      new Date(
        '2026-01-05T01:00:00.000Z',
      ),

    publishedAt:
      null,
  });

function createContext(): {
  context: CourseVersionRollbackTransactionContext;
  findVersionById: ReturnType<
    typeof vi.fn
  >;
  findLatestVersionByCourseId: ReturnType<
    typeof vi.fn
  >;
  saveVersion: ReturnType<
    typeof vi.fn
  >;
  appendLineage: ReturnType<
    typeof vi.fn
  >;
  appendAudit: ReturnType<
    typeof vi.fn
  >;
} {
  const findVersionById =
    vi.fn();

  const findLatestVersionByCourseId =
    vi.fn();

  const saveVersion =
    vi
      .fn()
      .mockResolvedValue(
        undefined,
      );

  const appendLineage =
    vi
      .fn()
      .mockResolvedValue(
        undefined,
      );

  const appendAudit =
    vi
      .fn()
      .mockResolvedValue(
        undefined,
      );

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
  executeSpy?: CourseVersionRollbackPersistence['execute'],
): CourseVersionRollbackPersistence {
  const execute =
    executeSpy ??
    (async <T>(
      work: (
        context: CourseVersionRollbackTransactionContext,
      ) => Promise<T>,
    ): Promise<T> =>
      work(
        context,
      ));

  return {
    execute,
  };
}

describe(
  'DefaultCourseVersionRollbackApplicationService',
  () => {
    it(
      'creates a transactionally coordinated rollback result',
      async () => {
        const {
          context,
          findVersionById,
          findLatestVersionByCourseId,
          saveVersion,
          appendLineage,
          appendAudit,
        } = createContext();

        findVersionById.mockResolvedValue(
          source,
        );

        findLatestVersionByCourseId.mockResolvedValue(
          latest,
        );

        let executeCalls =
          0;

        const execute: CourseVersionRollbackPersistence['execute'] =
          async <T>(
            work: (
              context: CourseVersionRollbackTransactionContext,
            ) => Promise<T>,
          ): Promise<T> => {
            executeCalls += 1;

            return work(
              context,
            );
          };

        const persistence =
          createPersistence(
            context,
            execute,
          );

        const service =
          new DefaultCourseVersionRollbackApplicationService(
            persistence,
          );

        const result =
          await service.rollback({
            courseId:
              'course-001',

            sourceVersionId:
              'course-version-source',

            reason:
              'Restore stable published content.',

            actor: {
              type:
                COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,

              id:
                'user-001',
            },
          });

        expect(
          executeCalls,
        ).toBe(
          1,
        );

        expect(
          result.version.version,
        ).toBe(
          6,
        );

        expect(
          result.version.status,
        ).toBe(
          'DRAFT',
        );

        expect(
          result.version.courseId,
        ).toBe(
          'course-001',
        );

        expect(
          result.version.title,
        ).toBe(
          'Stable Course',
        );

        expect(
          result.version.description,
        ).toBe(
          'Stable historical version.',
        );

        expect(
          result.lineage.relation,
        ).toBe(
          COURSE_VERSION_LINEAGE_RELATION,
        );

        expect(
          result.lineage.sourceVersion,
        ).toBe(
          3,
        );

        expect(
          result.lineage.targetVersion,
        ).toBe(
          6,
        );

        expect(
          result.audit.eventType,
        ).toBe(
          COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,
        );

        expect(
          result.audit.actor.type,
        ).toBe(
          COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
        );

        expect(
          result.audit.actor.id,
        ).toBe(
          'user-001',
        );

        expect(
          result.audit.reason,
        ).toBe(
          'Restore stable published content.',
        );

        expect(
          result.audit.metadata.sourceVersion,
        ).toBe(
          3,
        );

        expect(
          result.audit.metadata.targetVersion,
        ).toBe(
          6,
        );

        expect(
          result.audit.metadata.sourceVersionId,
        ).toBe(
          'course-version-source',
        );

        expect(
          result.audit.metadata.targetVersionId,
        ).toBe(
          result.version.id.value,
        );

        expect(
          saveVersion,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          appendLineage,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          appendAudit,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      'chooses a version above the source when the historical source is newer than the current latest',
      async () => {
        const {
          context,
          findVersionById,
          findLatestVersionByCourseId,
        } = createContext();

        const historicalSource =
          CourseVersion.rehydrate({
            id:
              CourseVersionId.from(
                'course-version-historical',
              ),

            courseId:
              'course-001',

            version:
              10,

            status:
              'ARCHIVED',

            title:
              'Historical Course',

            description:
              null,

            createdAt:
              new Date(
                '2026-01-01T00:00:00.000Z',
              ),

            updatedAt:
              new Date(
                '2026-01-01T01:00:00.000Z',
              ),

            publishedAt:
              null,
          });

        findVersionById.mockResolvedValue(
          historicalSource,
        );

        findLatestVersionByCourseId.mockResolvedValue(
          latest,
        );

        const service =
          new DefaultCourseVersionRollbackApplicationService(
            createPersistence(
              context,
            ),
          );

        const result =
          await service.rollback({
            courseId:
              'course-001',

            sourceVersionId:
              'course-version-historical',

            reason:
              'Restore historical content.',

            actor: {
              type:
                COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,

              id:
                'system',
            },
          });

        expect(
          result.version.version,
        ).toBe(
          11,
        );
      },
    );

    it(
      'uses the source version plus one when there is no later version',
      async () => {
        const {
          context,
          findVersionById,
          findLatestVersionByCourseId,
        } = createContext();

        findVersionById.mockResolvedValue(
          source,
        );

        findLatestVersionByCourseId.mockResolvedValue(
          null,
        );

        const service =
          new DefaultCourseVersionRollbackApplicationService(
            createPersistence(
              context,
            ),
          );

        const result =
          await service.rollback({
            courseId:
              'course-001',

            sourceVersionId:
              'course-version-source',

            reason:
              'Restore historical content.',

            actor: {
              type:
                COURSE_VERSION_AUDIT_ACTOR_TYPE.SERVICE,

              id:
                'rollback-service',
            },
          });

        expect(
          result.version.version,
        ).toBe(
          4,
        );
      },
    );

    it(
      'rejects a missing rollback source',
      async () => {
        const {
          context,
          findVersionById,
        } = createContext();

        findVersionById.mockResolvedValue(
          null,
        );

        const service =
          new DefaultCourseVersionRollbackApplicationService(
            createPersistence(
              context,
            ),
          );

        await expect(
          service.rollback({
            courseId:
              'course-002',

            sourceVersionId:
              'missing-version',

            reason:
              'Source does not exist.',

            actor: {
              type:
                COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,

              id:
                'system',
            },
          }),
        ).rejects.toThrow(
          'CourseVersion rollback source was not found.',
        );
      },
    );

    it(
      'rejects a source belonging to another Course',
      async () => {
        const {
          context,
          findVersionById,
        } = createContext();

        findVersionById.mockResolvedValue(
          source,
        );

        const service =
          new DefaultCourseVersionRollbackApplicationService(
            createPersistence(
              context,
            ),
          );

        await expect(
          service.rollback({
            courseId:
              'course-other',

            sourceVersionId:
              'course-version-source',

            reason:
              'Invalid Course scope.',

            actor: {
              type:
                COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,

              id:
                'user-001',
            },
          }),
        ).rejects.toThrow(
          'CourseVersion rollback source does not belong to the specified Course.',
        );
      },
    );
  },
);