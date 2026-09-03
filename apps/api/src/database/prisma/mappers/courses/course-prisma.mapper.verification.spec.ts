import {
  Course,
  CourseId,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
} from '@gurusthalam/courses';
import type {
  CourseModel,
} from '@gurusthalam/database';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CoursePrismaMapper,
} from './course-prisma.mapper.js';

describe(
  'CoursePrismaMapper verification',
  () => {
    const createdAt = new Date(
      '2026-01-01T10:00:00.000Z',
    );
    const updatedAt = new Date(
      '2026-01-02T10:00:00.000Z',
    );

    const baseRecord: CourseModel = {
      id: 'course-001',
      title: 'Advanced TypeScript',
      description: 'A complete TypeScript course.',
      level: 'ADVANCED',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'DRAFT',
      instructorId: 'instructor-001',
      createdAt,
      updatedAt,
    };

    it(
      'round-trips every supported Course enum combination without semantic drift',
      () => {
        const levels = [
          CourseLevel.BEGINNER,
          CourseLevel.INTERMEDIATE,
          CourseLevel.ADVANCED,
          CourseLevel.ALL_LEVELS,
        ];

        const types = [
          CourseType.SELF_PACED,
          CourseType.LIVE,
          CourseType.BLENDED,
        ];

        const visibilities = [
          CourseVisibility.PRIVATE,
          CourseVisibility.UNLISTED,
          CourseVisibility.PUBLIC,
        ];

        const statuses = [
          CourseStatus.DRAFT,
          CourseStatus.IN_REVIEW,
          CourseStatus.PUBLISHED,
          CourseStatus.UNPUBLISHED,
          CourseStatus.ARCHIVED,
        ];

        for (const level of levels) {
          for (const type of types) {
            for (const visibility of visibilities) {
              for (const status of statuses) {
                const course = Course.rehydrate({
                  id: CourseId.from(baseRecord.id),
                  title: baseRecord.title,
                  description: baseRecord.description,
                  level,
                  type,
                  visibility,
                  status,
                  instructorId:
                    baseRecord.instructorId,
                  createdAt,
                  updatedAt,
                });

                const persistence =
                  CoursePrismaMapper.toPersistence(
                    course,
                  );

                const restored =
                  CoursePrismaMapper.toDomain(
                    persistence as CourseModel,
                  );

                expect(restored.toPrimitives()).toEqual(
                  course.toPrimitives(),
                );
              }
            }
          }
        }
      },
    );

    it(
      'preserves nullable description values through both mapper directions',
      () => {
        const record: CourseModel = {
          ...baseRecord,
          description: null,
        };

        const domain =
          CoursePrismaMapper.toDomain(record);
        const persistence =
          CoursePrismaMapper.toPersistence(domain);

        expect(domain.description).toBeNull();
        expect(persistence.description).toBeNull();
      },
    );

    it(
      'creates independent Date instances when rehydrating and persisting timestamps',
      () => {
        const domain =
          CoursePrismaMapper.toDomain(
            baseRecord,
          );
        const persistence =
          CoursePrismaMapper.toPersistence(
            domain,
          );

        expect(domain.createdAt).toEqual(
          baseRecord.createdAt,
        );
        expect(domain.updatedAt).toEqual(
          baseRecord.updatedAt,
        );
        expect(persistence.createdAt).toEqual(
          baseRecord.createdAt,
        );
        expect(persistence.updatedAt).toEqual(
          baseRecord.updatedAt,
        );

        expect(domain.createdAt).not.toBe(
          baseRecord.createdAt,
        );
        expect(domain.updatedAt).not.toBe(
          baseRecord.updatedAt,
        );
        expect(persistence.createdAt).not.toBe(
          domain.createdAt,
        );
        expect(persistence.updatedAt).not.toBe(
          domain.updatedAt,
        );
      },
    );
  },
);
