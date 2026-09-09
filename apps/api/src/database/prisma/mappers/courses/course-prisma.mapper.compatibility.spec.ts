import {
  Course,
  CourseId,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseVisibility,
  CourseDomainEventName,
} from '@gurusthalam/courses';
import type { CourseModel } from '@gurusthalam/database';
import { describe, expect, it } from 'vitest';

import {
  CoursePrismaMapper,
  type PrismaCourseRecord,
} from './course-prisma.mapper.js';

describe('CoursePrismaMapper — compatibility regression', () => {
  const createdAt = new Date('2026-01-10T10:00:00.000Z');
  const updatedAt = new Date('2026-01-12T15:30:00.000Z');

  const baseRecord: CourseModel = {
    id: 'course-compatibility-001',
    title: 'Advanced TypeScript',
    description: 'A production-focused TypeScript course.',
    level: 'ADVANCED',
    type: 'SELF_PACED',
    visibility: 'PUBLIC',
    status: 'DRAFT',
    instructorId: 'instructor-compatibility-001',
    createdAt,
    updatedAt,
  };

  function toRecord(overrides: Partial<CourseModel> = {}): PrismaCourseRecord {
    return {
      ...baseRecord,
      ...overrides,
    };
  }

  function expectCompleteCourseState(
    course: Course,
    record: PrismaCourseRecord,
  ): void {
    expect(course.id.value).toBe(record.id);
    expect(course.title).toBe(record.title);
    expect(course.description).toBe(record.description);
    expect(course.level).toBe(record.level);
    expect(course.type).toBe(record.type);
    expect(course.visibility).toBe(record.visibility);
    expect(course.status).toBe(record.status);
    expect(course.instructorId).toBe(record.instructorId);
    expect(course.createdAt).toEqual(record.createdAt);
    expect(course.updatedAt).toEqual(record.updatedAt);
  }

  it('preserves every persisted Course field during persistence-to-domain mapping', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);

    expectCompleteCourseState(course, baseRecord);
  });

  it('preserves every Course field during domain-to-persistence mapping', () => {
    const course = Course.rehydrate({
      id: CourseId.from(baseRecord.id),
      title: baseRecord.title,
      description: baseRecord.description,
      level: CourseLevel.ADVANCED,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
      status: CourseStatus.DRAFT,
      instructorId: baseRecord.instructorId,
      createdAt,
      updatedAt,
    });

    const persistence = CoursePrismaMapper.toPersistence(course);

    expect(persistence).toEqual(baseRecord);
  });

  it('preserves null descriptions across the complete persistence boundary', () => {
    const record = toRecord({
      description: null,
    });

    const course = CoursePrismaMapper.toDomain(record);
    const persistence = CoursePrismaMapper.toPersistence(course);

    expect(course.description).toBeNull();
    expect(persistence.description).toBeNull();
  });

  it('preserves Course identity across a complete persistence round-trip', () => {
    const original = CoursePrismaMapper.toDomain(baseRecord);

    const persistence = CoursePrismaMapper.toPersistence(original);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    expect(rehydrated.id.value).toBe(original.id.value);
  });

  it('preserves timestamps across a complete persistence round-trip', () => {
    const original = CoursePrismaMapper.toDomain(baseRecord);

    const persistence = CoursePrismaMapper.toPersistence(original);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    expect(rehydrated.createdAt).toEqual(original.createdAt);
    expect(rehydrated.updatedAt).toEqual(original.updatedAt);

    expect(rehydrated.createdAt.getTime()).toBeLessThanOrEqual(
      rehydrated.updatedAt.getTime(),
    );
  });

  it('preserves the createdAt <= updatedAt invariant across persistence round-trips', () => {
    const record = toRecord({
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const course = CoursePrismaMapper.toDomain(record);

    const persistence = CoursePrismaMapper.toPersistence(course);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    expect(rehydrated.createdAt.getTime()).toBeLessThanOrEqual(
      rehydrated.updatedAt.getTime(),
    );
  });

  it.each([
    'DRAFT',
    'IN_REVIEW',
    'PUBLISHED',
    'UNPUBLISHED',
    'ARCHIVED',
  ] as const)(
    'preserves lifecycle status %s during persistence round-trip',
    (status) => {
      const record = toRecord({
        status,
      });

      const course = CoursePrismaMapper.toDomain(record);

      const persistence = CoursePrismaMapper.toPersistence(course);

      const rehydrated = CoursePrismaMapper.toDomain(
        persistence as PrismaCourseRecord,
      );

      expect(rehydrated.status).toBe(status);
      expect(persistence.status).toBe(status);
    },
  );

  it('rehydrates without creating synthetic domain events', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);

    expect(course.getDomainEvents()).toEqual([]);
  });

  it('does not create synthetic events after a complete persistence round-trip', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);

    const persistence = CoursePrismaMapper.toPersistence(course);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    expect(rehydrated.getDomainEvents()).toEqual([]);
  });

  it('allows a legitimate metadata mutation after rehydration', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);

    course.updateMetadata({
      title: 'Advanced TypeScript — Production Edition',
    });

    expect(course.title).toBe('Advanced TypeScript — Production Edition');

    const events = course.getDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);
  });

  it('preserves metadata event semantics after a persistence round-trip', () => {
    const original = CoursePrismaMapper.toDomain(baseRecord);

    const persistence = CoursePrismaMapper.toPersistence(original);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    rehydrated.updateMetadata({
      description: 'Updated after persistence round-trip.',
    });

    const events = rehydrated.getDomainEvents();

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event?.eventName).toBe(CourseDomainEventName.METADATA_UPDATED);

    if (event?.eventName !== CourseDomainEventName.METADATA_UPDATED) {
      throw new Error('Expected a CourseMetadataUpdated domain event.');
    }

    expect(event.aggregateId).toBe(baseRecord.id);

    expect(event.payload.title).toBe(baseRecord.title);

    expect(event.payload.description).toBe(
      'Updated after persistence round-trip.',
    );
  });

  it('keeps a no-op metadata update event-free after rehydration', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);
    const originalUpdatedAt = course.updatedAt;

    course.updateMetadata({
      title: baseRecord.title,
      description: baseRecord.description,
      level: CourseLevel.ADVANCED,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
    });

    expect(course.title).toBe(baseRecord.title);
    expect(course.description).toBe(baseRecord.description);
    expect(course.level).toBe(CourseLevel.ADVANCED);
    expect(course.type).toBe(CourseType.SELF_PACED);
    expect(course.visibility).toBe(CourseVisibility.PUBLIC);

    expect(course.updatedAt).toEqual(originalUpdatedAt);
    expect(course.getDomainEvents()).toEqual([]);
  });

  it('produces deterministic persistence state for repeated mapping of the same aggregate', () => {
    const course = CoursePrismaMapper.toDomain(baseRecord);

    const firstPersistence = CoursePrismaMapper.toPersistence(course);

    const secondPersistence = CoursePrismaMapper.toPersistence(course);

    expect(secondPersistence).toEqual(firstPersistence);

    expect(secondPersistence.createdAt).not.toBe(firstPersistence.createdAt);

    expect(secondPersistence.updatedAt).not.toBe(firstPersistence.updatedAt);
  });

  it('preserves the complete aggregate state after domain-to-persistence-to-domain round-trip', () => {
    const original = Course.rehydrate({
      id: CourseId.from(baseRecord.id),
      title: baseRecord.title,
      description: baseRecord.description,
      level: CourseLevel.ADVANCED,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PUBLIC,
      status: CourseStatus.DRAFT,
      instructorId: baseRecord.instructorId,
      createdAt,
      updatedAt,
    });

    const persistence = CoursePrismaMapper.toPersistence(original);

    const rehydrated = CoursePrismaMapper.toDomain(
      persistence as PrismaCourseRecord,
    );

    expect(rehydrated.id.value).toBe(original.id.value);
    expect(rehydrated.title).toBe(original.title);
    expect(rehydrated.description).toBe(original.description);
    expect(rehydrated.level).toBe(original.level);
    expect(rehydrated.type).toBe(original.type);
    expect(rehydrated.visibility).toBe(original.visibility);
    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.instructorId).toBe(original.instructorId);
    expect(rehydrated.createdAt).toEqual(original.createdAt);
    expect(rehydrated.updatedAt).toEqual(original.updatedAt);

    expect(rehydrated.getDomainEvents()).toEqual([]);
  });
});
