import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CourseVersion,
  CourseVersionAudit,
  CourseVersionId,
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
} from '@gurusthalam/courses';

import type {
  PrismaClient,
} from '@gurusthalam/database';

import type {
  PrismaCourseVersionAuditPersistence,
} from '../../mappers/courses/course-version-audit-prisma.mapper.js';

import {
  PrismaCourseVersionAuditRepository,
} from './prisma-course-version-audit.repository.js';

describe(
  'PrismaCourseVersionAuditRepository',
  () => {
    const create =
      vi.fn();

    const findMany =
      vi.fn();

    const prisma = {
      courseVersionAudit: {
        create,
        findMany,
      },
    } as unknown as PrismaClient;

    const repository =
      new PrismaCourseVersionAuditRepository(
        prisma,
      );

    const courseVersionId =
      CourseVersionId.from(
        'course-version-001',
      );

    const courseVersion =
      CourseVersion.rehydrate({
        id:
          courseVersionId,
        courseId:
          'course-001',
        version:
          4,
        status:
          'PUBLISHED',
        title:
          'TypeScript Fundamentals',
        description:
          'Production TypeScript.',
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

    const createAudit =
      (
        id: string,
        occurredAt: string,
        version = 4,
      ): CourseVersionAudit =>
        CourseVersionAudit.create({
          id,
          version:
            version === 4
              ? courseVersion
              : CourseVersion.rehydrate({
                  ...courseVersion.toPrimitives(),
                  id:
                    CourseVersionId.generate(),
                  version,
                }),
          eventType:
            COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,
          occurredAt:
            new Date(occurredAt),
          actor: {
            type:
              COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
            id:
              'user-001',
          },
          reason:
            'Test audit entry.',
          metadata: {
            source:
              'test',
          },
        });

    const record =
      (
        audit: CourseVersionAudit,
      ) =>
        ({
          id:
            audit.id,
          courseId:
            audit.courseId,
          courseVersionId:
            audit.courseVersionId.value,
          version:
            audit.version,
          eventType:
            audit.eventType,
          occurredAt:
            audit.occurredAt,
          actorType:
            audit.actor.type,
          actorId:
            audit.actor.id,
          reason:
            audit.reason,
          metadata:
            audit.metadata,
        }) as PrismaCourseVersionAuditPersistence;

    const resetMocks =
      (): void => {
        create.mockReset();
        findMany.mockReset();
      };

    it(
      'appends an immutable audit entry',
      async () => {
        resetMocks();

        const audit =
          createAudit(
            'audit-001',
            '2026-01-01T03:00:00.000Z',
          );

        create.mockResolvedValue(
          record(audit),
        );

        await expect(
          repository.append(
            audit,
          ),
        ).resolves.toBeUndefined();

        expect(
          create,
        ).toHaveBeenCalledTimes(1);

        expect(
          create,
        ).toHaveBeenCalledWith({
          data: {
            id:
              'audit-001',
            courseId:
              'course-001',
            courseVersionId:
              'course-version-001',
            version:
              4,
            eventType:
              'VERSION_PUBLISHED',
            occurredAt:
              new Date(
                '2026-01-01T03:00:00.000Z',
              ),
            actorType:
              'USER',
            actorId:
              'user-001',
            reason:
              'Test audit entry.',
            metadata: {
              source:
                'test',
            },
          },
        });
      },
    );

    it(
      'finds audit entries by CourseVersion in deterministic chronological order',
      async () => {
        resetMocks();

        const first =
          createAudit(
            'audit-001',
            '2026-01-01T03:00:00.000Z',
          );

        const second =
          createAudit(
            'audit-002',
            '2026-01-01T04:00:00.000Z',
          );

        findMany.mockResolvedValue([
          record(first),
          record(second),
        ]);

        const result =
          await repository.findByCourseVersionId(
            courseVersionId,
          );

        expect(
          findMany,
        ).toHaveBeenCalledWith({
          where: {
            courseVersionId:
              'course-version-001',
          },
          orderBy: [
            {
              occurredAt:
                'asc',
            },
            {
              id:
                'asc',
            },
          ],
        });

        expect(
          result.map(
            (entry) =>
              entry.id,
          ),
        ).toEqual([
          'audit-001',
          'audit-002',
        ]);
      },
    );

    it(
      'returns an empty collection for a CourseVersion with no audit entries',
      async () => {
        resetMocks();

        findMany.mockResolvedValue(
          [],
        );

        await expect(
          repository.findByCourseVersionId(
            courseVersionId,
          ),
        ).resolves.toEqual(
          [],
        );
      },
    );

    it(
      'finds Course-wide audit history with deterministic ordering',
      async () => {
        resetMocks();

        const first =
          createAudit(
            'audit-001',
            '2026-01-01T03:00:00.000Z',
          );

        findMany.mockResolvedValue([
          record(first),
        ]);

        const result =
          await repository.findByCourseId(
            'course-001',
          );

        expect(
          findMany,
        ).toHaveBeenCalledWith({
          where: {
            courseId:
              'course-001',
          },
          orderBy: [
            {
              occurredAt:
                'asc',
            },
            {
              version:
                'asc',
            },
            {
              id:
                'asc',
            },
          ],
        });

        expect(
          result,
        ).toHaveLength(1);

        expect(
          result.at(0)?.id,
        ).toBe(
          'audit-001',
        );
      },
    );

    it(
      'returns an empty collection when a Course has no audit history',
      async () => {
        resetMocks();

        findMany.mockResolvedValue(
          [],
        );

        await expect(
          repository.findByCourseId(
            'course-001',
          ),
        ).resolves.toEqual(
          [],
        );
      },
    );

    it(
      'does not expose update or delete operations',
      () => {
        expect(
          'update' in repository,
        ).toBe(false);

        expect(
          'delete' in repository,
        ).toBe(false);
      },
    );
  },
);