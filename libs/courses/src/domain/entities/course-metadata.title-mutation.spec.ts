import { describe, expect, it } from 'vitest';

import {
  Course,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseValidationError,
  CourseVisibility,
} from '../../index.js';

describe('Course title mutation boundary', () => {
  const createCourse = () =>
    Course.create({
      title: 'Original Course Title',
      description: 'Original course description',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-1',
    });

  describe('valid title mutation', () => {
    it('updates the title when a valid title is provided', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.title).toBe('Updated Course Title');
    });

    it('preserves the DRAFT lifecycle status after title mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('preserves the aggregate identity when the title changes', () => {
      const course = createCourse();
      const beforeId = course.id.toString();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.id.toString()).toBe(beforeId);
    });

    it('preserves the description when only the title changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.description).toBe('Original course description');
    });

    it('preserves the level when only the title changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.level).toBe(CourseLevel.BEGINNER);
    });

    it('preserves the type when only the title changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.type).toBe(CourseType.SELF_PACED);
    });

    it('preserves the visibility when only the title changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.visibility).toBe(CourseVisibility.PRIVATE);
    });
  });

  describe('title boundary values', () => {
    it('accepts a single-character title', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'A',
      });

      expect(course.title).toBe('A');
    });

    it('accepts a title containing internal spaces', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Advanced Course Design',
      });

      expect(course.title).toBe('Advanced Course Design');
    });

    it('accepts a title containing punctuation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Node.js & TypeScript: Advanced APIs!',
      });

      expect(course.title).toBe(
        'Node.js & TypeScript: Advanced APIs!',
      );
    });

    it('accepts a title exactly 200 characters long', () => {
      const course = createCourse();
      const title = 'A'.repeat(200);

      course.updateMetadata({
        title,
      });

      expect(course.title).toBe(title);
      expect(course.title).toHaveLength(200);
    });

    it('rejects a title longer than 200 characters', () => {
      const course = createCourse();
      const title = 'A'.repeat(201);

      expect(() =>
        course.updateMetadata({
          title,
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('whitespace behavior', () => {
    it('trims leading and trailing whitespace from a valid title', () => {
      const course = createCourse();

      course.updateMetadata({
        title: '  Updated Course Title  ',
      });

      expect(course.title).toBe('Updated Course Title');
    });

    it('preserves meaningful internal whitespace', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated  Course   Title',
      });

      expect(course.title).toBe('Updated  Course   Title');
    });

    it('rejects an empty title', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects a whitespace-only title', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '     ',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects a title that becomes empty after trimming', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: ' \t\n ',
        }),
      ).toThrow(CourseValidationError);
    });

    it('allows surrounding whitespace when the trimmed title remains valid', () => {
      const course = createCourse();

      course.updateMetadata({
        title: '   A   ',
      });

      expect(course.title).toBe('A');
    });
  });

  describe('failed title mutation atomicity', () => {
    it('preserves the original title after an empty-title rejection', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('Original Course Title');
    });

    it('preserves the original title after a whitespace-only rejection', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: '   ',
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('Original Course Title');
    });

    it('preserves the original title after a length rejection', () => {
      const course = createCourse();

      expect(() =>
        course.updateMetadata({
          title: 'A'.repeat(201),
        }),
      ).toThrow(CourseValidationError);

      expect(course.title).toBe('Original Course Title');
    });

    it('does not change updatedAt after a rejected title mutation', () => {
      const course = createCourse();
      const beforeUpdatedAt = course.updatedAt.getTime();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.updatedAt.getTime()).toBe(beforeUpdatedAt);
    });

    it('does not append a domain event after a rejected title mutation', () => {
      const course = createCourse();
      const beforeEvents = course.getDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });

    it('preserves all other metadata after a rejected title mutation', () => {
      const course = createCourse();
      const before = course.toPrimitives();

      expect(() =>
        course.updateMetadata({
          title: 'A'.repeat(201),
        }),
      ).toThrow(CourseValidationError);

      expect(course.toPrimitives()).toEqual(before);
    });
  });

  describe('successful mutation timing', () => {
    it('updates updatedAt after a successful title mutation', () => {
      const course = createCourse();
      const beforeUpdatedAt = course.updatedAt.getTime();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdatedAt,
      );
    });

    it('preserves createdAt after a successful title mutation', () => {
      const course = createCourse();
      const beforeCreatedAt = course.createdAt.getTime();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      expect(course.createdAt.getTime()).toBe(beforeCreatedAt);
    });
  });

  describe('domain-event behavior', () => {
    it('records exactly one metadata event for a successful title mutation', () => {
      const course = createCourse();

      const beforeEvents = course.getDomainEvents();
      const beforeCount = beforeEvents.length;

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      const events = course.getDomainEvents();

      expect(events).toHaveLength(beforeCount + 1);
    });

    it('records the metadata-updated event as the final event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
      });

      const events = course.getDomainEvents();
      const event = events.at(-1);

      expect(event).toBeDefined();
      expect(event?.eventName).toBe(
        'courses.course.metadata_updated',
      );
    });

    it('does not create an additional event when a title mutation fails', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Valid Title',
      });

      const beforeEvents = course.getDomainEvents();

      expect(() =>
        course.updateMetadata({
          title: '',
        }),
      ).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });
  });

  describe('repeated title mutation', () => {
    it('allows multiple valid title changes while remaining in DRAFT', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Updated Title',
      });

      course.updateMetadata({
        title: 'Second Updated Title',
      });

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.title).toBe('Second Updated Title');
    });

    it('keeps only the latest title as aggregate state', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Updated Title',
      });

      course.updateMetadata({
        title: 'Second Updated Title',
      });

      expect(course.title).toBe('Second Updated Title');
      expect(course.title).not.toBe('First Updated Title');
    });
  });
});