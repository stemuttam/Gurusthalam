import { describe, expect, it } from 'vitest';

import { COURSE_VERSION_AUDIT_ACTOR_TYPE } from '../../domain/versioning/course-version-audit.js';

import { courseVersionRollbackInputSchema } from './course-version-rollback.validation.js';

describe('CourseVersion rollback validation contract', () => {
  const validInput = {
    courseId: 'course-001',
    sourceVersionId: 'course-version-003',
    reason: 'Restore the stable published version.',
    actor: {
      type: COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
      id: 'user-001',
    },
  };

  describe('valid input', () => {
    it('accepts the complete rollback contract', () => {
      const result = courseVersionRollbackInputSchema.parse(validInput);

      expect(result).toEqual(validInput);
    });

    it('accepts every supported audit actor type', () => {
      const actorTypes = [
        COURSE_VERSION_AUDIT_ACTOR_TYPE.USER,
        COURSE_VERSION_AUDIT_ACTOR_TYPE.SYSTEM,
        COURSE_VERSION_AUDIT_ACTOR_TYPE.SERVICE,
      ] as const;

      for (const type of actorTypes) {
        const result = courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: {
            ...validInput.actor,
            type,
          },
        });

        expect(result.actor.type).toBe(type);
      }
    });

    it('trims Course identifiers', () => {
      const result = courseVersionRollbackInputSchema.parse({
        ...validInput,
        courseId: '  course-001  ',
        sourceVersionId: '  course-version-003  ',
      });

      expect(result.courseId).toBe('course-001');
      expect(result.sourceVersionId).toBe('course-version-003');
    });

    it('trims the rollback reason', () => {
      const result = courseVersionRollbackInputSchema.parse({
        ...validInput,
        reason: '  Restore stable content.  ',
      });

      expect(result.reason).toBe('Restore stable content.');
    });

    it('trims the actor identifier', () => {
      const result = courseVersionRollbackInputSchema.parse({
        ...validInput,
        actor: {
          ...validInput.actor,
          id: '  user-001  ',
        },
      });

      expect(result.actor.id).toBe('user-001');
    });

    it('accepts a rollback reason at the 500-character boundary', () => {
      const reason = 'R'.repeat(500);

      const result = courseVersionRollbackInputSchema.parse({
        ...validInput,
        reason,
      });

      expect(result.reason).toHaveLength(500);
    });
  });

  describe('identifier validation', () => {
    it('rejects an empty Course identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          courseId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only Course identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          courseId: '   ',
        }),
      ).toThrow();
    });

    it('rejects an empty source version identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          sourceVersionId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only source version identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          sourceVersionId: '   ',
        }),
      ).toThrow();
    });

    it('rejects an empty actor identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: {
            ...validInput.actor,
            id: '',
          },
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only actor identifier', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: {
            ...validInput.actor,
            id: '   ',
          },
        }),
      ).toThrow();
    });
  });

  describe('reason validation', () => {
    it('rejects an empty rollback reason', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          reason: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only rollback reason', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          reason: '   ',
        }),
      ).toThrow();
    });

    it('rejects a rollback reason longer than 500 characters', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          reason: 'R'.repeat(501),
        }),
      ).toThrow('Rollback reason must not exceed 500 characters.');
    });
  });

  describe('actor validation', () => {
    it('rejects an unsupported actor type', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: {
            type: 'AI_AGENT',
            id: 'agent-001',
          },
        }),
      ).toThrow();
    });

    it('rejects a missing actor object', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: undefined,
        }),
      ).toThrow();
    });

    it('rejects unexpected actor fields', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          actor: {
            ...validInput.actor,
            authorization: 'admin',
          },
        }),
      ).toThrow();
    });
  });

  describe('strict contract boundary', () => {
    it('rejects unexpected top-level fields', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          version: 7,
        }),
      ).toThrow();
    });

    it('does not allow callers to control the target version', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          targetVersion: 99,
        }),
      ).toThrow();
    });

    it('does not allow callers to control the audit event type', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          eventType: 'VERSION_PUBLISHED',
        }),
      ).toThrow();
    });

    it('does not allow callers to provide persistence identifiers', () => {
      expect(() =>
        courseVersionRollbackInputSchema.parse({
          ...validInput,
          id: 'rollback-001',
          courseVersionId: 'course-version-006',
        }),
      ).toThrow();
    });
  });
});
