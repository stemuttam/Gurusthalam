import {
  CourseVersion,
  CourseVersionId,
  type CourseVersionStatus,
} from '@gurusthalam/courses';

import type {
  CourseVersionModel,
} from '@gurusthalam/database';

import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CourseVersionPrismaMapper,
} from './course-version-prisma.mapper.js';

describe(
  'CourseVersionPrismaMapper verification',
  () => {
    const createdAt = new Date(
      '2026-01-01T10:00:00.000Z',
    );

    const updatedAt = new Date(
      '2026-01-02T10:00:00.000Z',
    );

    const publishedAt = new Date(
      '2026-01-03T10:00:00.000Z',
    );

    const baseRecord: CourseVersionModel = {
      id: 'course-version-001',
      courseId: 'course-001',
      version: 1,
      status: 'DRAFT',
      title: 'Advanced TypeScript',
      description:
        'A complete TypeScript course.',
      createdAt,
      updatedAt,
      publishedAt: null,
    };

    it(
      'round-trips every supported CourseVersion status without semantic drift',
      () => {
        const statuses: CourseVersionStatus[] = [
          'DRAFT',
          'IN_REVIEW',
          'PUBLISHED',
          'ARCHIVED',
        ];

        for (const status of statuses) {
          const courseVersion =
            CourseVersion.rehydrate({
              id: CourseVersionId.from(
                baseRecord.id,
              ),
              courseId: baseRecord.courseId,
              version: baseRecord.version,
              status,
              title: baseRecord.title,
              description:
                baseRecord.description,
              createdAt,
              updatedAt,
              publishedAt:
                status === 'PUBLISHED'
                  ? publishedAt
                  : null,
            });

          const persistence =
            CourseVersionPrismaMapper.toPersistence(
              courseVersion,
            );

          const restored =
            CourseVersionPrismaMapper.toDomain(
              persistence as CourseVersionModel,
            );

          expect(
            restored.toPrimitives(),
          ).toEqual(
            courseVersion.toPrimitives(),
          );
        }
      },
    );

    it(
      'preserves nullable description and publishedAt values through both mapper directions',
      () => {
        const record: CourseVersionModel = {
          ...baseRecord,
          description: null,
          publishedAt: null,
        };

        const domain =
          CourseVersionPrismaMapper.toDomain(
            record,
          );

        const persistence =
          CourseVersionPrismaMapper.toPersistence(
            domain,
          );

        expect(
          domain.description,
        ).toBeNull();

        expect(
          domain.publishedAt,
        ).toBeNull();

        expect(
          persistence.description,
        ).toBeNull();

        expect(
          persistence.publishedAt,
        ).toBeNull();
      },
    );

    it(
      'preserves publishedAt when present while keeping timestamp values independent',
      () => {
        const record: CourseVersionModel = {
          ...baseRecord,
          status: 'PUBLISHED',
          publishedAt,
        };

        const domain =
          CourseVersionPrismaMapper.toDomain(
            record,
          );

        const persistence =
          CourseVersionPrismaMapper.toPersistence(
            domain,
          );

        expect(
          domain.createdAt,
        ).toEqual(createdAt);

        expect(
          domain.updatedAt,
        ).toEqual(updatedAt);

        expect(
          domain.publishedAt,
        ).toEqual(publishedAt);

        expect(
          persistence.createdAt,
        ).toEqual(createdAt);

        expect(
          persistence.updatedAt,
        ).toEqual(updatedAt);

        expect(
          persistence.publishedAt,
        ).toEqual(publishedAt);

        expect(
          domain.createdAt,
        ).not.toBe(record.createdAt);

        expect(
          domain.updatedAt,
        ).not.toBe(record.updatedAt);

        expect(
          domain.publishedAt,
        ).not.toBe(record.publishedAt);

        expect(
          persistence.createdAt,
        ).not.toBe(domain.createdAt);

        expect(
          persistence.updatedAt,
        ).not.toBe(domain.updatedAt);

        expect(
          persistence.publishedAt,
        ).not.toBe(domain.publishedAt);
      },
    );

    it(
      'preserves course identity, version numbers, and all supported version values exactly',
      () => {
        const versions = [
          1,
          2,
          42,
          999,
        ];

        for (const version of versions) {
          const courseVersion =
            CourseVersion.rehydrate({
              id: CourseVersionId.from(
                baseRecord.id,
              ),
              courseId: baseRecord.courseId,
              version,
              status: 'DRAFT',
              title: baseRecord.title,
              description:
                baseRecord.description,
              createdAt,
              updatedAt,
              publishedAt: null,
            });

          const persistence =
            CourseVersionPrismaMapper.toPersistence(
              courseVersion,
            );

          const restored =
            CourseVersionPrismaMapper.toDomain(
              persistence as CourseVersionModel,
            );

          expect(
            persistence.courseId,
          ).toBe(baseRecord.courseId);

          expect(
            persistence.version,
          ).toBe(version);

          expect(
            restored.courseId,
          ).toBe(baseRecord.courseId);

          expect(
            restored.version,
          ).toBe(version);
        }
      },
    );
  },
);