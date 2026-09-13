import { describe, expect, it } from 'vitest';

import {
  CourseVersion,
  CourseVersionAudit,
  CourseVersionId,
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
} from '@gurusthalam/courses';

import type { CourseVersionAuditModel } from '@gurusthalam/database';

import { CourseVersionAuditPrismaMapper } from './course-version-audit-prisma.mapper.js';

const courseVersion = CourseVersion.rehydrate({
  id: CourseVersionId.from('course-version-001'),

  courseId: 'course-001',

  version: 4,

  status: 'PUBLISHED',

  title: 'TypeScript Fundamentals',

  description: 'Production TypeScript.',

  createdAt: new Date('2026-01-01T00:00:00.000Z'),

  updatedAt: new Date('2026-01-01T01:00:00.000Z'),

  publishedAt: new Date('2026-01-01T02:00:00.000Z'),
});

const audit = CourseVersionAudit.create({
  id: 'audit-001',

  version: courseVersion,

  eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,

  occurredAt: new Date('2026-01-01T03:00:00.000Z'),

  actor: {
    type: COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,

    id: 'user-001',
  },

  reason: 'Published after successful review.',

  metadata: {
    source: 'publish-workflow',

    attempt: 1,

    approved: true,
  },
});

const persistence = CourseVersionAuditPrismaMapper.toPersistence(audit);

const record = persistence as CourseVersionAuditModel;

describe('CourseVersionAuditPrismaMapper', () => {
  it('maps an audit domain object to Prisma persistence state', () => {
    expect(persistence).toEqual({
      id: 'audit-001',

      courseId: 'course-001',

      courseVersionId: 'course-version-001',

      version: 4,

      eventType: 'VERSION_PUBLISHED',

      occurredAt: new Date('2026-01-01T03:00:00.000Z'),

      actorType: 'USER',

      actorId: 'user-001',

      reason: 'Published after successful review.',

      metadata: {
        source: 'publish-workflow',

        attempt: 1,

        approved: true,
      },
    });
  });

  it('rehydrates Prisma data into the domain audit contract', () => {
    const result = CourseVersionAuditPrismaMapper.toDomain(record);

    expect(result).toBeInstanceOf(CourseVersionAudit);

    expect(result.toPrimitives()).toEqual(audit.toPrimitives());
  });

  it('preserves null reason and metadata values', () => {
    const nullReasonAudit = CourseVersionAudit.create({
      id: 'audit-002',

      version: courseVersion,

      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,

      actor: {
        type: COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,

        id: 'system',
      },

      reason: null,

      metadata: {
        nullable: null,
      },
    });

    const mapped =
      CourseVersionAuditPrismaMapper.toPersistence(nullReasonAudit);

    expect(mapped.reason).toBeNull();

    expect(mapped.metadata).toEqual({
      nullable: null,
    });
  });

  it('returns independent Date instances', () => {
    const mapped = CourseVersionAuditPrismaMapper.toPersistence(audit);

    const restored = CourseVersionAuditPrismaMapper.toDomain(
      mapped as CourseVersionAuditModel,
    );

    expect(restored.occurredAt).not.toBe(audit.occurredAt);

    expect(restored.occurredAt).toEqual(audit.occurredAt);
  });
});
