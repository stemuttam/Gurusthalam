import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  PrismaClient,
} from '@gurusthalam/database';

import {
  CourseId,
  CourseVersion,
  CourseVersionAudit,
  CourseVersionId,
  CourseVersionLineage,
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
  COURSE_VERSION_LINEAGE_RELATION,
} from '@gurusthalam/courses';

import {
  PrismaCourseVersionRollbackTransaction,
} from './course-version-rollback.transaction.js';

describe(
  'PrismaCourseVersionRollbackTransaction',
  () => {
    it(
      'executes rollback work inside a Prisma transaction and coordinates version, lineage, and audit writes',
      async () => {
        const sourceRecord = {
          id:
            'course-version-source',

          courseId:
            'course-001',

          version:
            3,

          status:
            'PUBLISHED' as const,

          title:
            'Stable Course',

          description:
            'Stable course.',

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
        };

        const latestRecord = {
          ...sourceRecord,

          id:
            'course-version-latest',

          version:
            5,

          status:
            'DRAFT' as const,

          publishedAt:
            null,
        };

        const transactionClient = {
          courseVersion: {
            findUnique:
              vi
                .fn()
                .mockResolvedValue(
                  sourceRecord,
                ),

            findFirst:
              vi
                .fn()
                .mockResolvedValue(
                  latestRecord,
                ),

            create:
              vi
                .fn()
                .mockResolvedValue(
                  undefined,
                ),
          },

          courseVersionLineage: {
            create:
              vi
                .fn()
                .mockResolvedValue(
                  undefined,
                ),
          },

          courseVersionAudit: {
            create:
              vi
                .fn()
                .mockResolvedValue(
                  undefined,
                ),
          },
        };

        const $transaction =
          vi.fn(
            async (
              callback: (
                transaction:
                  typeof transactionClient,
              ) => Promise<unknown>,
            ) =>
              callback(
                transactionClient,
              ),
          );

        const prisma =
          {
            $transaction,
          } as unknown as PrismaClient;

        const transaction =
          new PrismaCourseVersionRollbackTransaction(
            prisma,
          );

        const sourceId =
          CourseVersionId.from(
            'course-version-source',
          );

        const courseId =
          CourseId.from(
            'course-001',
          );

        const result =
          await transaction.execute(
            async (
              context,
            ) => {
              const source =
                await context.findVersionById(
                  sourceId,
                );

              if (
                source === null
              ) {
                throw new Error(
                  'Expected rollback source version to exist.',
                );
              }

              const latest =
                await context.findLatestVersionByCourseId(
                  courseId,
                );

              const targetVersion =
                Math.max(
                  source.version,
                  latest?.version ?? 0,
                ) + 1;

              const restoredVersion =
                CourseVersion.create({
                  courseId:
                    source.courseId,

                  version:
                    targetVersion,

                  title:
                    source.title,

                  description:
                    source.description,
                });

              const lineage =
                CourseVersionLineage.create({
                  source,

                  target:
                    restoredVersion,

                  reason:
                    'Restore stable version.',
                });

              const audit =
                CourseVersionAudit.create({
                  id:
                    'audit-001',

                  version:
                    restoredVersion,

                  eventType:
                    COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,

                  actor: {
                    type:
                      COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,

                    id:
                      'rollback-service',
                  },

                  reason:
                    'Restore stable version.',

                  metadata: {
                    sourceVersion:
                      source.version,

                    targetVersion:
                      restoredVersion.version,

                    relation:
                      COURSE_VERSION_LINEAGE_RELATION,
                  },
                });

              await context.saveVersion(
                restoredVersion,
              );

              await context.appendLineage(
                lineage,
              );

              await context.appendAudit(
                audit,
              );

              return {
                source,
                latest,
                restoredVersion,
                lineage,
                audit,
              };
            },
          );

        expect(
          $transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result.source.id.value,
        ).toBe(
          'course-version-source',
        );

        expect(
          result.latest?.version,
        ).toBe(
          5,
        );

        expect(
          result.restoredVersion.version,
        ).toBe(
          6,
        );

        expect(
          result.restoredVersion.status,
        ).toBe(
          'DRAFT',
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
          result.lineage.relation,
        ).toBe(
          COURSE_VERSION_LINEAGE_RELATION,
        );

        expect(
          result.audit.eventType,
        ).toBe(
          COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,
        );

        expect(
          result.audit.actor.type,
        ).toBe(
          COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,
        );

        expect(
          result.audit.actor.id,
        ).toBe(
          'rollback-service',
        );

        expect(
          transactionClient
            .courseVersion
            .findUnique,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transactionClient
            .courseVersion
            .findFirst,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transactionClient
            .courseVersion
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transactionClient
            .courseVersionLineage
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          transactionClient
            .courseVersionAudit
            .create,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);