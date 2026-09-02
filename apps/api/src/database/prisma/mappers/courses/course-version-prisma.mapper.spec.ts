import {
  CourseVersion,
  CourseVersionId,
} from '@gurusthalam/courses';
import type {
  CourseVersionModel,
} from '@gurusthalam/database';
import { describe, expect, it } from 'vitest';

import {
  CourseVersionPrismaMapper,
} from './course-version-prisma.mapper.js';

describe('CourseVersionPrismaMapper', () => {
  const createdAt = new Date('2026-01-01T10:00:00.000Z');
  const updatedAt = new Date('2026-01-02T10:00:00.000Z');
  const publishedAt = new Date(
    '2026-01-03T10:00:00.000Z',
  );

  const record: CourseVersionModel = {
    id: 'course-version-001',
    courseId: 'course-001',
    version: 1,
    status: 'PUBLISHED',
    title: 'Advanced TypeScript',
    description: 'A complete TypeScript course.',
    createdAt,
    updatedAt,
    publishedAt,
  };

  it('rehydrates Prisma data into CourseVersion', () => {
    const courseVersion =
      CourseVersionPrismaMapper.toDomain(record);

    expect(courseVersion.id.value).toBe(record.id);
    expect(courseVersion.courseId).toBe(
      record.courseId,
    );
    expect(courseVersion.version).toBe(
      record.version,
    );
    expect(courseVersion.status).toBe(
      record.status,
    );
    expect(courseVersion.title).toBe(
      record.title,
    );
    expect(courseVersion.description).toBe(
      record.description,
    );
    expect(courseVersion.createdAt).toEqual(
      createdAt,
    );
    expect(courseVersion.updatedAt).toEqual(
      updatedAt,
    );
    expect(courseVersion.publishedAt).toEqual(
      publishedAt,
    );
  });

  it('maps CourseVersion into Prisma persistence data', () => {
    const courseVersion =
      CourseVersion.rehydrate({
        id: CourseVersionId.from(record.id),
        courseId: record.courseId,
        version: record.version,
        status: 'PUBLISHED',
        title: record.title,
        description: record.description,
        createdAt,
        updatedAt,
        publishedAt,
      });

    const persistence =
      CourseVersionPrismaMapper.toPersistence(
        courseVersion,
      );

    expect(persistence).toEqual(record);
  });

  it('preserves null optional values', () => {
    const draftRecord: CourseVersionModel = {
      ...record,
      status: 'DRAFT',
      description: null,
      publishedAt: null,
    };

    const courseVersion =
      CourseVersionPrismaMapper.toDomain(
        draftRecord,
      );

    expect(courseVersion.description).toBeNull();
    expect(courseVersion.publishedAt).toBeNull();

    const persistence =
      CourseVersionPrismaMapper.toPersistence(
        courseVersion,
      );

    expect(persistence.description).toBeNull();
    expect(persistence.publishedAt).toBeNull();
  });

  it('preserves version numbers exactly', () => {
    const courseVersion =
      CourseVersionPrismaMapper.toDomain({
        ...record,
        version: 42,
      });

    expect(courseVersion.version).toBe(42);

    const persistence =
      CourseVersionPrismaMapper.toPersistence(
        courseVersion,
      );

    expect(persistence.version).toBe(42);
  });
});