import { describe, expect, it } from 'vitest';

import { Course } from './course.js';

import { CourseLevel } from '../enums/course-level.js';
import { CourseStatus } from '../enums/course-status.js';
import { CourseType } from '../enums/course-type.js';
import { CourseVisibility } from '../enums/course-visibility.js';

import { CourseValidationError } from '../errors/index.js';
import { CourseDomainEventName } from '../events/index.js';

const ORIGINAL_TITLE = 'Original Course Title';

const ORIGINAL_DESCRIPTION =
  'Original course description used to verify metadata preservation.';

const ORIGINAL_LEVEL = CourseLevel.BEGINNER;
const ORIGINAL_TYPE = CourseType.SELF_PACED;
const ORIGINAL_VISIBILITY = CourseVisibility.PRIVATE;
const ORIGINAL_INSTRUCTOR_ID = 'instructor-123';

function createCourse(): Course {
  return Course.create({
    title: ORIGINAL_TITLE,
    description: ORIGINAL_DESCRIPTION,
    level: ORIGINAL_LEVEL,
    type: ORIGINAL_TYPE,
    visibility: ORIGINAL_VISIBILITY,
    instructorId: ORIGINAL_INSTRUCTOR_ID,
  });
}

describe('Course description mutation boundary', () => {
  describe('valid description mutation', () => {
    it('updates the description when a valid description is provided', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated course description.',
      });

      expect(course.description).toBe('Updated course description.');
    });

    it('preserves the DRAFT lifecycle status after description mutation', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('preserves the aggregate identity when the description changes', () => {
      const course = createCourse();
      const originalId = course.id;

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.id).toBe(originalId);
    });

    it('preserves the title when only the description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.title).toBe(ORIGINAL_TITLE);
    });

    it('preserves the level when only the description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.level).toBe(ORIGINAL_LEVEL);
    });

    it('preserves the type when only the description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.type).toBe(ORIGINAL_TYPE);
    });

    it('preserves the visibility when only the description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.visibility).toBe(ORIGINAL_VISIBILITY);
    });

    it('preserves the instructor ownership when only the description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.instructorId).toBe(ORIGINAL_INSTRUCTOR_ID);
    });
  });

  describe('description boundary values', () => {
    it('accepts a single-character description', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'A',
      });

      expect(course.description).toBe('A');
    });

    it('accepts a description containing internal spaces', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'A meaningful course description',
      });

      expect(course.description).toBe('A meaningful course description');
    });

    it('accepts a description containing punctuation', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Learn safely, clearly, and consistently.',
      });

      expect(course.description).toBe(
        'Learn safely, clearly, and consistently.',
      );
    });

    it('accepts a description exactly 10000 characters long', () => {
      const course = createCourse();
      const description = 'D'.repeat(10_000);

      course.updateMetadata({
        description,
      });

      expect(course.description).toBe(description);
      expect(course.description).toHaveLength(10_000);
    });

    it('rejects a description longer than 10000 characters', () => {
      const course = createCourse();
      const description = 'D'.repeat(10_001);

      expect(() => {
        course.updateMetadata({
          description,
        });
      }).toThrow(CourseValidationError);
    });
  });

  describe('whitespace behavior', () => {
    it('trims leading and trailing whitespace from a valid description', () => {
      const course = createCourse();

      course.updateMetadata({
        description: '   Updated description   ',
      });

      expect(course.description).toBe('Updated description');
    });

    it('preserves meaningful internal whitespace', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated   course   description',
      });

      expect(course.description).toBe('Updated   course   description');
    });

    it('rejects an empty description', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);
    });

    it('rejects a whitespace-only description', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: '     ',
        });
      }).toThrow(CourseValidationError);
    });

    it('rejects a description that becomes empty after trimming', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: ' \t\n ',
        });
      }).toThrow(CourseValidationError);
    });

    it('allows surrounding whitespace when the trimmed description remains valid', () => {
      const course = createCourse();

      course.updateMetadata({
        description: '\n\t  Valid description  \t\n',
      });

      expect(course.description).toBe('Valid description');
    });
  });

  describe('failed description mutation atomicity', () => {
    it('preserves the original description after an empty-description rejection', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.description).toBe(ORIGINAL_DESCRIPTION);
    });

    it('preserves the original description after a whitespace-only rejection', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: '     ',
        });
      }).toThrow(CourseValidationError);

      expect(course.description).toBe(ORIGINAL_DESCRIPTION);
    });

    it('preserves the original description after a length rejection', () => {
      const course = createCourse();
      const originalDescription = course.description;

      expect(() => {
        course.updateMetadata({
          description: 'D'.repeat(10_001),
        });
      }).toThrow(CourseValidationError);

      expect(course.description).toBe(originalDescription);
    });

    it('does not change updatedAt after a rejected description mutation', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt;

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.updatedAt).toEqual(originalUpdatedAt);
    });

    it('does not append a domain event after a rejected description mutation', () => {
      const course = createCourse();
      const eventCount = course.getDomainEvents().length;

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });

    it('preserves all other metadata after a rejected description mutation', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.title).toBe(ORIGINAL_TITLE);
      expect(course.level).toBe(ORIGINAL_LEVEL);
      expect(course.type).toBe(ORIGINAL_TYPE);
      expect(course.visibility).toBe(ORIGINAL_VISIBILITY);
      expect(course.instructorId).toBe(ORIGINAL_INSTRUCTOR_ID);
      expect(course.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('successful mutation timing', () => {
    it('updates updatedAt after a successful description mutation', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt;

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });

    it('preserves createdAt after a successful description mutation', () => {
      const course = createCourse();
      const originalCreatedAt = course.createdAt;

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.createdAt).toEqual(originalCreatedAt);
    });
  });

  describe('domain-event behavior', () => {
    it('records exactly one metadata event for a successful description mutation', () => {
      const course = createCourse();
      const eventCount = course.getDomainEvents().length;

      course.updateMetadata({
        description: 'Updated description.',
      });

      expect(course.getDomainEvents()).toHaveLength(eventCount + 1);
    });

    it('records the metadata-updated event as the final event', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'Updated description.',
      });

      const events = course.getDomainEvents();
      const finalEvent = events[events.length - 1];

      expect(finalEvent?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });

    it('does not create an additional event when a description mutation fails', () => {
      const course = createCourse();
      const eventCount = course.getDomainEvents().length;

      expect(() => {
        course.updateMetadata({
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(eventCount);
    });
  });

  describe('repeated description mutation', () => {
    it('allows multiple valid description changes while remaining in DRAFT', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'First updated description.',
      });

      course.updateMetadata({
        description: 'Second updated description.',
      });

      course.updateMetadata({
        description: 'Final updated description.',
      });

      expect(course.description).toBe('Final updated description.');
      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('keeps only the latest description as aggregate state', () => {
      const course = createCourse();

      course.updateMetadata({
        description: 'First description.',
      });

      course.updateMetadata({
        description: 'Second description.',
      });

      expect(course.description).toBe('Second description.');
      expect(course.description).not.toBe('First description.');
    });
  });
});