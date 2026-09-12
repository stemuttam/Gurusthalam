import { describe, expect, it } from 'vitest';

import { CourseVersion } from '../entities/course-version.js';
import { CourseVersionId } from '../value-objects/course-version-id.js';
import {
  COURSE_VERSION_AUDIT_ACTOR_TYPE,
  COURSE_VERSION_AUDIT_EVENT_TYPE,
  CourseVersionAudit,
  isCourseVersionAuditActorType,
  isCourseVersionAuditEventType,
  isValidCourseVersionAuditMetadataValue,
} from './course-version-audit.js';

const createVersion = (version = 1): CourseVersion =>
  CourseVersion.rehydrate({
    id: CourseVersionId.generate(),
    courseId: 'course-123',
    version,
    status: 'PUBLISHED',
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T01:00:00.000Z'),
    publishedAt: new Date('2026-01-01T02:00:00.000Z'),
  });

const actor = {
  type: COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
  id: 'user-123',
} as const;

describe('CourseVersionAudit', () => {
  it('creates a version-created audit entry', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-001',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
      actor,
    });

    expect(audit.id).toBe('audit-001');
    expect(audit.courseId).toBe('course-123');
    expect(audit.courseVersionId.equals(version.id)).toBe(true);
    expect(audit.version).toBe(1);
    expect(audit.eventType).toBe(
      COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
    );
    expect(audit.reason).toBeNull();
  });

  it('supports every defined audit event type', () => {
    const version = createVersion();

    for (const eventType of Object.values(COURSE_VERSION_AUDIT_EVENT_TYPE)) {
      const audit = CourseVersionAudit.create({
        id: `audit-${eventType}`,
        version,
        eventType,
        actor,
      });

      expect(audit.eventType).toBe(eventType);
    }
  });

  it('normalizes actor and reason values', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: '  audit-002  ',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,
      actor: {
        type: COURSE_VERSION_AUDIT_ACTOR_TYPE.SERVICE,
        id: '  rollback-service  ',
      },
      reason: '  Restore previously published content.  ',
    });

    expect(audit.id).toBe('audit-002');
    expect(audit.actor.id).toBe('rollback-service');
    expect(audit.reason).toBe('Restore previously published content.');
  });

  it('preserves the supplied occurrence timestamp', () => {
    const version = createVersion();

    const occurredAt = new Date('2026-02-10T12:30:00.000Z');

    const audit = CourseVersionAudit.create({
      id: 'audit-003',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,
      occurredAt,
      actor,
    });

    expect(audit.occurredAt).toEqual(occurredAt);

    expect(audit.occurredAt).not.toBe(occurredAt);
  });

  it('creates an occurrence timestamp when one is omitted', () => {
    const version = createVersion();

    const before = Date.now();

    const audit = CourseVersionAudit.create({
      id: 'audit-004',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
      actor,
    });

    const after = Date.now();

    expect(audit.occurredAt.getTime()).toBeGreaterThanOrEqual(before);

    expect(audit.occurredAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('preserves valid metadata', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-005',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ROLLBACK_CREATED,
      actor,
      metadata: {
        sourceVersion: 1,
        restorationMode: 'FULL',
        approved: true,
        note: null,
      },
    });

    expect(audit.metadata).toEqual({
      sourceVersion: 1,
      restorationMode: 'FULL',
      approved: true,
      note: null,
    });
  });

  it('freezes the audit record, actor and metadata', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-006',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
      actor,
      metadata: {
        source: 'test',
      },
    });

    expect(Object.isFrozen(audit)).toBe(true);

    expect(Object.isFrozen(audit.actor)).toBe(true);

    expect(Object.isFrozen(audit.metadata)).toBe(true);
  });

  it('does not expose mutable metadata', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-007',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
      actor,
      metadata: {
        source: 'original',
      },
    });

    expect(() => {
      (audit.metadata as Record<string, string>).source = 'changed';
    }).toThrow();

    expect(audit.metadata).toEqual({
      source: 'original',
    });
  });

  it('returns defensive timestamp copies', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-008',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
      actor,
      occurredAt: new Date('2026-03-15T10:00:00.000Z'),
    });

    const timestamp = audit.occurredAt;

    timestamp.setUTCFullYear(2030);

    expect(audit.occurredAt.toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });

  it('rehydrates an audit record without changing its identity', () => {
    const version = createVersion(7);

    const original = CourseVersionAudit.create({
      id: 'audit-009',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_ARCHIVED,
      occurredAt: new Date('2026-03-01T10:00:00.000Z'),
      actor,
      reason: 'Administrative archival.',
      metadata: {
        source: 'admin-console',
      },
    });

    const rehydrated = CourseVersionAudit.rehydrate(original.toPrimitives());

    expect(rehydrated.toPrimitives()).toEqual(original.toPrimitives());
  });

  it('returns detached primitives', () => {
    const version = createVersion();

    const audit = CourseVersionAudit.create({
      id: 'audit-010',
      version,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,
      occurredAt: new Date('2026-04-01T08:00:00.000Z'),
      actor,
      reason: 'Published after review.',
      metadata: {
        source: 'publish-workflow',
        attempt: 1,
      },
    });

    const primitives = audit.toPrimitives();

    expect(primitives).toEqual({
      id: 'audit-010',
      courseId: 'course-123',
      courseVersionId: version.id,
      version: 1,
      eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,
      occurredAt: new Date('2026-04-01T08:00:00.000Z'),
      actor: {
        type: COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
        id: 'user-123',
      },
      reason: 'Published after review.',
      metadata: {
        source: 'publish-workflow',
        attempt: 1,
      },
    });
  });

  it('rejects an empty audit identifier', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: '   ',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor,
      }),
    ).toThrow(TypeError);
  });

  it('rejects an oversized audit identifier', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'x'.repeat(201),
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor,
      }),
    ).toThrow(TypeError);
  });

  it('rejects an empty actor identifier', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-011',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor: {
          type: COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
          id: '   ',
        },
      }),
    ).toThrow(TypeError);
  });

  it('rejects an unsupported actor type', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-012',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor: {
          type: 'AI_MODEL' as never,
          id: 'model-123',
        },
      }),
    ).toThrow(TypeError);
  });

  it('rejects an unsupported event type', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-013',
        version,
        eventType: 'VERSION_RESTORED' as never,
        actor,
      }),
    ).toThrow(TypeError);
  });

  it('rejects invalid version numbers during rehydration', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.rehydrate({
        id: 'audit-014',
        courseId: 'course-123',
        courseVersionId: version.id,
        version: 0,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        actor,
        reason: null,
        metadata: {},
      }),
    ).toThrow(TypeError);

    expect(() =>
      CourseVersionAudit.rehydrate({
        id: 'audit-015',
        courseId: 'course-123',
        courseVersionId: version.id,
        version: 1.5,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        actor,
        reason: null,
        metadata: {},
      }),
    ).toThrow(TypeError);
  });

  it('rejects an invalid occurrence timestamp', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.rehydrate({
        id: 'audit-016',
        courseId: 'course-123',
        courseVersionId: version.id,
        version: 1,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        occurredAt: new Date('invalid-date'),
        actor,
        reason: null,
        metadata: {},
      }),
    ).toThrow(TypeError);
  });

  it('rejects an empty reason', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-017',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor,
        reason: '   ',
      }),
    ).toThrow(TypeError);
  });

  it('rejects an oversized reason', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-018',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor,
        reason: 'x'.repeat(501),
      }),
    ).toThrow(TypeError);
  });

  it('rejects unsupported metadata value types', () => {
    const version = createVersion();

    expect(() =>
      CourseVersionAudit.create({
        id: 'audit-019',
        version,
        eventType: COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_CREATED,
        actor,
        metadata: {
          invalid: {
            nested: true,
          } as never,
        },
      }),
    ).toThrow(TypeError);
  });

  it('exposes stable type guards', () => {
    expect(
      isCourseVersionAuditEventType(
        COURSE_VERSION_AUDIT_EVENT_TYPE.VERSION_PUBLISHED,
      ),
    ).toBe(true);

    expect(isCourseVersionAuditEventType('UNKNOWN')).toBe(false);

    expect(
      isCourseVersionAuditActorType(COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM),
    ).toBe(true);

    expect(isCourseVersionAuditActorType('BOT')).toBe(false);

    expect(isValidCourseVersionAuditMetadataValue('value')).toBe(true);

    expect(isValidCourseVersionAuditMetadataValue(42)).toBe(true);

    expect(isValidCourseVersionAuditMetadataValue(true)).toBe(true);

    expect(isValidCourseVersionAuditMetadataValue(null)).toBe(true);

    expect(isValidCourseVersionAuditMetadataValue({ nested: true })).toBe(
      false,
    );
  });
});
