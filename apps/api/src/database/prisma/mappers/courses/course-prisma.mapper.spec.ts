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
import { describe, expect, it } from 'vitest';

import {
  CoursePrismaMapper,
  type PrismaCourseRecord,
} from './course-prisma.mapper.js';

describe('CoursePrismaMapper', () => {
  const createdAt = new Date('2026-01-01T10:00:00.000Z');
  const updatedAt = new Date('2026-01-02T10:00:00.000Z');

  const record: CourseModel = {
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

  it('rehydrates a Prisma Course into the domain', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
      );

    expect(course.id.value).toBe(record.id);
    expect(course.title).toBe(record.title);
    expect(course.description).toBe(record.description);
    expect(course.level).toBe(CourseLevel.ADVANCED);
    expect(course.type).toBe(CourseType.SELF_PACED);
    expect(course.visibility).toBe(CourseVisibility.PUBLIC);
    expect(course.status).toBe(CourseStatus.DRAFT);
    expect(course.instructorId).toBe(
      record.instructorId,
    );
    expect(course.createdAt).toEqual(createdAt);
    expect(course.updatedAt).toEqual(updatedAt);
  });

  it('maps the domain Course into Prisma persistence data', () => {
    const course = Course.rehydrate({
      id: CourseId.from(record.id),
      title: record.title,
      description: record.description,
      level: CourseLevel.ADVANCED,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
      status: CourseStatus.DRAFT,
      instructorId: record.instructorId,
      createdAt,
      updatedAt,
    });

    const persistence =
      CoursePrismaMapper.toPersistence(course);

    expect(persistence).toEqual(record);
  });

  it('preserves null descriptions', () => {
    const course =
      CoursePrismaMapper.toDomain({
        ...record,
        description: null,
      } as PrismaCourseRecord);

    expect(course.description).toBeNull();

    const persistence =
      CoursePrismaMapper.toPersistence(course);

    expect(persistence.description).toBeNull();
  });

  it('preserves timestamps as independent Date instances', () => {
    const course =
      CoursePrismaMapper.toDomain(
        record as PrismaCourseRecord,
      );

    const persistence =
      CoursePrismaMapper.toPersistence(course);

    expect(persistence.createdAt).not.toBe(
      course.createdAt,
    );
    expect(persistence.updatedAt).not.toBe(
      course.updatedAt,
    );

    expect(persistence.createdAt).toEqual(
      createdAt,
    );
    expect(persistence.updatedAt).toEqual(
      updatedAt,
    );
  });
});