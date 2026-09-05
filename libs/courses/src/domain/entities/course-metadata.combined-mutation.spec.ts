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

describe('Course combined metadata mutation boundary', () => {
  describe('successful combined mutation', () => {
    it('updates title and description together', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course Title',
        description: 'Updated course description.',
      });

      expect(course.title).toBe('Updated Course Title');
      expect(course.description).toBe('Updated course description.');
    });

    it('trims title and description during combined mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: '   Updated Course Title   ',
        description: '   Updated course description.   ',
      });

      expect(course.title).toBe('Updated Course Title');
      expect(course.description).toBe('Updated course description.');
    });

    it('preserves meaningful internal whitespace', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated   Course   Title',
        description: 'Updated   course   description.',
      });

      expect(course.title).toBe('Updated   Course   Title');
      expect(course.description).toBe(
        'Updated   course   description.',
      );
    });

    it('preserves the aggregate identity', () => {
      const course = createCourse();
      const originalId = course.id;

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.id).toBe(originalId);
    });

    it('preserves level, type, and visibility', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.level).toBe(ORIGINAL_LEVEL);
      expect(course.type).toBe(ORIGINAL_TYPE);
      expect(course.visibility).toBe(ORIGINAL_VISIBILITY);
    });

    it('preserves instructor ownership', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.instructorId).toBe(ORIGINAL_INSTRUCTOR_ID);
    });

    it('preserves DRAFT status', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('combined mutation timing', () => {
    it('preserves createdAt', () => {
      const course = createCourse();
      const originalCreatedAt = course.createdAt;

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.createdAt).toEqual(originalCreatedAt);
    });

    it('updates updatedAt', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt;

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('combined mutation domain events', () => {
    it('records exactly one metadata event', () => {
      const course = createCourse();
      const originalEventCount = course.getDomainEvents().length;

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      expect(course.getDomainEvents()).toHaveLength(
        originalEventCount + 1,
      );
    });

    it('records metadata-updated as the final event', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Updated Course',
        description: 'Updated description.',
      });

      const events = course.getDomainEvents();
      const finalEvent = events[events.length - 1];

      expect(finalEvent?.eventName).toBe(
        CourseDomainEventName.METADATA_UPDATED,
      );
    });
  });

  describe('invalid title atomicity', () => {
    it('rejects an invalid title without changing the description', () => {
      const course = createCourse();
      const originalDescription = course.description;

      expect(() => {
        course.updateMetadata({
          title: '   ',
          description: 'New description.',
        });
      }).toThrow(CourseValidationError);

      expect(course.title).toBe(ORIGINAL_TITLE);
      expect(course.description).toBe(originalDescription);
    });

    it('rejects an oversized title without changing the description', () => {
      const course = createCourse();
      const originalDescription = course.description;

      expect(() => {
        course.updateMetadata({
          title: 'T'.repeat(201),
          description: 'New description.',
        });
      }).toThrow(CourseValidationError);

      expect(course.title).toBe(ORIGINAL_TITLE);
      expect(course.description).toBe(originalDescription);
    });

    it('does not update updatedAt after invalid title rejection', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt;

      expect(() => {
        course.updateMetadata({
          title: '',
          description: 'New description.',
        });
      }).toThrow(CourseValidationError);

      expect(course.updatedAt).toEqual(originalUpdatedAt);
    });

    it('does not append an event after invalid title rejection', () => {
      const course = createCourse();
      const originalEventCount = course.getDomainEvents().length;

      expect(() => {
        course.updateMetadata({
          title: '',
          description: 'New description.',
        });
      }).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(
        originalEventCount,
      );
    });
  });

  describe('invalid description atomicity', () => {
    it('rejects an invalid description without changing the title', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          title: 'New Course Title',
          description: '   ',
        });
      }).toThrow(CourseValidationError);

      expect(course.title).toBe(ORIGINAL_TITLE);
      expect(course.description).toBe(ORIGINAL_DESCRIPTION);
    });

    it('rejects an oversized description without changing the title', () => {
      const course = createCourse();

      expect(() => {
        course.updateMetadata({
          title: 'New Course Title',
          description: 'D'.repeat(10_001),
        });
      }).toThrow(CourseValidationError);

      expect(course.title).toBe(ORIGINAL_TITLE);
      expect(course.description).toBe(ORIGINAL_DESCRIPTION);
    });

    it('does not update updatedAt after invalid description rejection', () => {
      const course = createCourse();
      const originalUpdatedAt = course.updatedAt;

      expect(() => {
        course.updateMetadata({
          title: 'New Course Title',
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.updatedAt).toEqual(originalUpdatedAt);
    });

    it('does not append an event after invalid description rejection', () => {
      const course = createCourse();
      const originalEventCount = course.getDomainEvents().length;

      expect(() => {
        course.updateMetadata({
          title: 'New Course Title',
          description: '',
        });
      }).toThrow(CourseValidationError);

      expect(course.getDomainEvents()).toHaveLength(
        originalEventCount,
      );
    });
  });

  describe('repeated combined mutation', () => {
    it('allows repeated valid title and description changes', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Course Title',
        description: 'First description.',
      });

      course.updateMetadata({
        title: 'Second Course Title',
        description: 'Second description.',
      });

      course.updateMetadata({
        title: 'Final Course Title',
        description: 'Final description.',
      });

      expect(course.title).toBe('Final Course Title');
      expect(course.description).toBe('Final description.');
      expect(course.status).toBe(CourseStatus.DRAFT);
    });

    it('keeps only the latest combined metadata as aggregate state', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'First Course Title',
        description: 'First description.',
      });

      course.updateMetadata({
        title: 'Second Course Title',
        description: 'Second description.',
      });

      expect(course.title).toBe('Second Course Title');
      expect(course.description).toBe('Second description.');
    });
  });
});