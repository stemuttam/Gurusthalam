import { describe, expect, it } from 'vitest';

import { CourseValidationError } from '../../errors/index.js';
import { CourseVersionId } from '../../value-objects/course-version-id.js';
import { SectionId } from '../identifiers/section-id.js';
import { Section } from './section.js';

const courseVersionId = CourseVersionId.from('course-version-001');

const createSection = () =>
  Section.create({
    courseVersionId,
    title: 'Introduction',
    description: 'Introduction to the course.',
    position: 1,
  });

const expectValidationIssue = (
  action: () => void,
  field: string,
  message: string,
  expectedErrorMessage?: string,
): void => {
  let error: unknown;

  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(CourseValidationError);

  if (!(error instanceof CourseValidationError)) {
    return;
  }

  if (expectedErrorMessage !== undefined) {
    expect(error.message).toBe(expectedErrorMessage);
  }

  expect(error.issues).toContainEqual({
    field,
    message,
  });
};

describe('Section', () => {
  describe('create', () => {
    it('creates a valid Section', () => {
      const section = createSection();

      expect(section.id.value).toBeTypeOf('string');
      expect(section.courseVersionId.equals(courseVersionId)).toBe(true);
      expect(section.title).toBe('Introduction');
      expect(section.description).toBe('Introduction to the course.');
      expect(section.position).toBe(1);
      expect(section.createdAt).toBeInstanceOf(Date);
      expect(section.updatedAt).toBeInstanceOf(Date);
    });

    it('generates distinct identities', () => {
      const first = createSection();
      const second = createSection();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('preserves the owning CourseVersion identity', () => {
      const firstVersionId = CourseVersionId.from('course-version-001');
      const secondVersionId = CourseVersionId.from('course-version-002');

      const first = Section.create({
        courseVersionId: firstVersionId,
        title: 'Section',
        position: 1,
      });

      const second = Section.create({
        courseVersionId: secondVersionId,
        title: 'Section',
        position: 1,
      });

      expect(first.courseVersionId.equals(firstVersionId)).toBe(true);
      expect(second.courseVersionId.equals(secondVersionId)).toBe(true);
      expect(first.courseVersionId.equals(second.courseVersionId)).toBe(false);
    });

    it('supports a nullable description', () => {
      const section = Section.create({
        courseVersionId,
        title: 'Introduction',
        description: null,
        position: 1,
      });

      expect(section.description).toBeNull();
    });

    it('rejects a missing title', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: '   ',
            position: 1,
          }),
        'title',
        'Section title must be a non-empty string.',
        'Section validation failed.',
      );
    });

    it('rejects a title longer than 200 characters', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'A'.repeat(201),
            position: 1,
          }),
        'title',
        'Section title must not exceed 200 characters.',
        'Section validation failed.',
      );
    });

    it('rejects an empty-string description', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'Introduction',
            description: '   ',
            position: 1,
          }),
        'description',
        'Section description must be null or a non-empty string.',
        'Section validation failed.',
      );
    });

    it('rejects an oversized description', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'Introduction',
            description: 'A'.repeat(10_001),
            position: 1,
          }),
        'description',
        'Section description must not exceed 10000 characters.',
        'Section validation failed.',
      );
    });

    it('rejects zero position', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'Introduction',
            position: 0,
          }),
        'position',
        'Section position must be a positive integer.',
        'Section validation failed.',
      );
    });

    it('rejects negative position', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'Introduction',
            position: -1,
          }),
        'position',
        'Section position must be a positive integer.',
        'Section validation failed.',
      );
    });

    it('rejects fractional position', () => {
      expectValidationIssue(
        () =>
          Section.create({
            courseVersionId,
            title: 'Introduction',
            position: 1.5,
          }),
        'position',
        'Section position must be a positive integer.',
        'Section validation failed.',
      );
    });
  });

  describe('metadata', () => {
    it('updates title and description', () => {
      const section = createSection();
      const previousUpdatedAt = section.updatedAt;

      section.updateMetadata({
        title: 'Getting Started',
        description: 'Learn the foundations first.',
      });

      expect(section.title).toBe('Getting Started');
      expect(section.description).toBe('Learn the foundations first.');
      expect(section.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('preserves unspecified metadata', () => {
      const section = createSection();

      section.updateMetadata({
        title: 'Getting Started',
      });

      expect(section.title).toBe('Getting Started');
      expect(section.description).toBe('Introduction to the course.');
    });

    it('allows the description to be cleared', () => {
      const section = createSection();

      section.updateMetadata({
        description: null,
      });

      expect(section.description).toBeNull();
    });

    it('normalizes updated textual metadata by trimming whitespace', () => {
      const section = createSection();

      section.updateMetadata({
        title: '  Getting Started  ',
        description: '  Foundations  ',
      });

      expect(section.title).toBe('Getting Started');
      expect(section.description).toBe('Foundations');
    });

    it('rejects invalid updated title', () => {
      const section = createSection();

      expectValidationIssue(
        () =>
          section.updateMetadata({
            title: '   ',
          }),
        'title',
        'Section title must be a non-empty string.',
      );

      expect(section.title).toBe('Introduction');
    });

    it('rejects invalid updated description', () => {
      const section = createSection();

      expectValidationIssue(
        () =>
          section.updateMetadata({
            description: '   ',
          }),
        'description',
        'Section description must be null or a non-empty string.',
      );

      expect(section.description).toBe('Introduction to the course.');
    });
  });

  describe('ordering', () => {
    it('changes position without changing identity', () => {
      const section = createSection();
      const originalId = section.id;

      section.moveToPosition(3);

      expect(section.id.equals(originalId)).toBe(true);
      expect(section.position).toBe(3);
    });

    it('does not update the timestamp for a no-op position change', () => {
      const section = createSection();
      const previousUpdatedAt = section.updatedAt;

      section.moveToPosition(1);

      expect(section.updatedAt.getTime()).toBe(previousUpdatedAt.getTime());
    });

    it('rejects invalid positions during movement', () => {
      const section = createSection();

      expectValidationIssue(
        () => section.moveToPosition(0),
        'position',
        'Section position must be a positive integer.',
      );

      expect(section.position).toBe(1);
    });
  });

  describe('serialization', () => {
    it('returns detached Date values', () => {
      const section = createSection();
      const primitives = section.toPrimitives();

      expect(primitives.id).toBe(section.id);
      expect(primitives.courseVersionId).toBe(section.courseVersionId);
      expect(primitives.createdAt).not.toBe(section.createdAt);
      expect(primitives.updatedAt).not.toBe(section.updatedAt);
    });
  });

  describe('rehydration', () => {
    it('preserves identity and state', () => {
      const section = createSection();

      const rehydrated = Section.rehydrate(section.toPrimitives());

      expect(rehydrated.id.equals(section.id)).toBe(true);
      expect(rehydrated.courseVersionId.equals(section.courseVersionId)).toBe(
        true,
      );
      expect(rehydrated.title).toBe(section.title);
      expect(rehydrated.description).toBe(section.description);
      expect(rehydrated.position).toBe(section.position);
      expect(rehydrated.createdAt).toEqual(section.createdAt);
      expect(rehydrated.updatedAt).toEqual(section.updatedAt);
    });

    it('accepts a rehydrated identifier without generating a new one', () => {
      const id = SectionId.from('section-persisted-001');

      const section = Section.rehydrate({
        id,
        courseVersionId,
        title: 'Persisted Section',
        description: null,
        position: 4,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

      expect(section.id.equals(id)).toBe(true);
      expect(section.position).toBe(4);
      expect(section.title).toBe('Persisted Section');
    });
  });

  describe('defensive state isolation', () => {
    it('does not expose mutable internal Date state', () => {
      const section = createSection();

      const createdAt = section.createdAt;
      const updatedAt = section.updatedAt;

      createdAt.setFullYear(2035);
      updatedAt.setFullYear(2035);

      expect(section.createdAt.getFullYear()).not.toBe(2035);
      expect(section.updatedAt.getFullYear()).not.toBe(2035);
    });
  });
});
