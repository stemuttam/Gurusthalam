import { describe, expect, it } from 'vitest';

import { Course, type CourseProps } from './course.js';
import { CourseValidationError } from '../errors/index.js';
import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';
import { CourseId } from '../value-objects/course-id.js';

function createPersistedCourseProps(
  overrides: Partial<CourseProps> = {},
): CourseProps {
  return {
    id: CourseId.from('course-rehydration-timestamp-001'),
    title: 'Persisted Course',
    description: 'Persisted course description.',
    level: CourseLevel.INTERMEDIATE,
    type: CourseType.SELF_PACED,
    visibility: CourseVisibility.PUBLIC,
    status: CourseStatus.DRAFT,
    instructorId: 'instructor-timestamp-001',
    createdAt: new Date('2026-01-10T10:00:00.000Z'),
    updatedAt: new Date('2026-02-15T12:30:45.000Z'),
    ...overrides,
  };
}

function expectValidationIssue(
  error: unknown,
  expectedIssue: {
    field: string;
    message: string;
  },
): void {
  expect(error).toBeInstanceOf(CourseValidationError);

  if (!(error instanceof CourseValidationError)) {
    return;
  }

  expect(error.issues).toContainEqual(expectedIssue);
}

describe('Course rehydration timestamp ordering', () => {
  describe('valid persisted timestamp state', () => {
    it('accepts createdAt equal to updatedAt', () => {
      const timestamp = new Date('2026-01-10T10:00:00.000Z');

      const persisted = createPersistedCourseProps({
        createdAt: timestamp,
        updatedAt: new Date(timestamp),
      });

      const course = Course.rehydrate(persisted);

      expect(course.createdAt.getTime()).toBe(timestamp.getTime());
      expect(course.updatedAt.getTime()).toBe(timestamp.getTime());
    });

    it('accepts createdAt earlier than updatedAt', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

      const course = Course.rehydrate(persisted);

      expect(course.createdAt.getTime()).toBe(
        new Date('2026-01-01T00:00:00.000Z').getTime(),
      );

      expect(course.updatedAt.getTime()).toBe(
        new Date('2026-01-02T00:00:00.000Z').getTime(),
      );
    });

    it('accepts historical persisted timestamps', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-12-31T23:59:59.999Z'),
      });

      const course = Course.rehydrate(persisted);

      expect(course.createdAt.toISOString()).toBe('2020-01-01T00:00:00.000Z');

      expect(course.updatedAt.toISOString()).toBe('2025-12-31T23:59:59.999Z');
    });
  });

  describe('invalid persisted timestamp state', () => {
    it('rejects createdAt later than updatedAt', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      try {
        Course.rehydrate(persisted);
      } catch (error) {
        expectValidationIssue(error, {
          field: 'updatedAt',
          message:
            'Course update timestamp cannot be earlier than creation timestamp.',
        });
      }
    });

    it('rejects an invalid createdAt value', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('invalid'),
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      try {
        Course.rehydrate(persisted);
      } catch (error) {
        expectValidationIssue(error, {
          field: 'createdAt',
          message: 'Course creation timestamp must be a valid Date.',
        });
      }
    });

    it('rejects an invalid updatedAt value', () => {
      const persisted = createPersistedCourseProps({
        updatedAt: new Date('invalid'),
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      try {
        Course.rehydrate(persisted);
      } catch (error) {
        expectValidationIssue(error, {
          field: 'updatedAt',
          message: 'Course update timestamp must be a valid Date.',
        });
      }
    });

    it('does not attempt timestamp ordering when createdAt is invalid', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('invalid'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      try {
        Course.rehydrate(persisted);
      } catch (error) {
        expectValidationIssue(error, {
          field: 'createdAt',
          message: 'Course creation timestamp must be a valid Date.',
        });
      }
    });

    it('does not attempt timestamp ordering when updatedAt is invalid', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('invalid'),
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      try {
        Course.rehydrate(persisted);
      } catch (error) {
        expectValidationIssue(error, {
          field: 'updatedAt',
          message: 'Course update timestamp must be a valid Date.',
        });
      }
    });
  });

  describe('rehydration safety', () => {
    it('does not produce a partially usable aggregate after validation failure', () => {
      const persisted = createPersistedCourseProps({
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      let course: Course | undefined;

      try {
        course = Course.rehydrate(persisted);
      } catch (error) {
        expect(error).toBeInstanceOf(CourseValidationError);
      }

      expect(course).toBeUndefined();
    });

    it('does not repair invalid timestamp ordering', () => {
      const createdAt = new Date('2026-03-01T00:00:00.000Z');
      const updatedAt = new Date('2026-02-01T00:00:00.000Z');

      const persisted = createPersistedCourseProps({
        createdAt,
        updatedAt,
      });

      expect(() => Course.rehydrate(persisted)).toThrow(CourseValidationError);

      expect(createdAt.getTime()).toBeGreaterThan(updatedAt.getTime());
    });

    it('does not generate domain events for valid rehydration', () => {
      const persisted = createPersistedCourseProps();

      const course = Course.rehydrate(persisted);

      expect(course.getDomainEvents()).toEqual([]);
    });

    it('preserves the persisted timestamps without replacing them with current time', () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-01-01T00:00:00.000Z');

      const course = Course.rehydrate(
        createPersistedCourseProps({
          createdAt,
          updatedAt,
        }),
      );

      expect(course.createdAt.getTime()).toBe(createdAt.getTime());
      expect(course.updatedAt.getTime()).toBe(updatedAt.getTime());
    });
  });
});
