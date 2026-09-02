import { describe, expect, it } from 'vitest';

import { CourseValidationError } from '../errors/index.js';
import { CourseVersion } from './course-version.js';

const createVersion = () =>
  CourseVersion.create({
    courseId: 'course-123',
    version: 1,
    title: 'TypeScript Fundamentals',
    description: 'Learn TypeScript from the ground up.',
  });

describe('CourseVersion', () => {
  describe('create', () => {
    it('creates a draft CourseVersion', () => {
      const version = createVersion();

      expect(version.id.value).toBeTypeOf('string');
      expect(version.courseId).toBe('course-123');
      expect(version.version).toBe(1);
      expect(version.status).toBe('DRAFT');
      expect(version.title).toBe('TypeScript Fundamentals');
      expect(version.description).toBe(
        'Learn TypeScript from the ground up.',
      );
      expect(version.publishedAt).toBeNull();
    });

    it('generates distinct identities', () => {
      const first = createVersion();
      const second = createVersion();

      expect(first.id.equals(second.id)).toBe(false);
    });

    it('rejects version zero', () => {
      expect(() =>
        CourseVersion.create({
          courseId: 'course-123',
          version: 0,
          title: 'Valid Course',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects negative versions', () => {
      expect(() =>
        CourseVersion.create({
          courseId: 'course-123',
          version: -1,
          title: 'Valid Course',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects fractional versions', () => {
      expect(() =>
        CourseVersion.create({
          courseId: 'course-123',
          version: 1.5,
          title: 'Valid Course',
        }),
      ).toThrow(CourseValidationError);
    });

    it('rejects an empty course identifier', () => {
      expect(() =>
        CourseVersion.create({
          courseId: '   ',
          version: 1,
          title: 'Valid Course',
        }),
      ).toThrow(CourseValidationError);
    });
  });

  describe('metadata', () => {
    it('updates metadata while in DRAFT', () => {
      const version = createVersion();
      const previousUpdatedAt = version.updatedAt;

      version.updateMetadata({
        title: 'Advanced TypeScript',
        description: 'Updated description.',
      });

      expect(version.title).toBe('Advanced TypeScript');
      expect(version.description).toBe('Updated description.');
      expect(version.updatedAt.getTime()).toBeGreaterThanOrEqual(
        previousUpdatedAt.getTime(),
      );
    });

    it('preserves unspecified metadata', () => {
      const version = createVersion();

      version.updateMetadata({
        title: 'Updated Title',
      });

      expect(version.title).toBe('Updated Title');
      expect(version.description).toBe(
        'Learn TypeScript from the ground up.',
      );
    });
  });

  describe('lifecycle', () => {
    it('moves from DRAFT to IN_REVIEW', () => {
      const version = createVersion();

      version.submitForReview();

      expect(version.status).toBe('IN_REVIEW');
    });

    it('moves from IN_REVIEW to PUBLISHED', () => {
      const version = createVersion();

      version.submitForReview();
      version.publish();

      expect(version.status).toBe('PUBLISHED');
      expect(version.publishedAt).toBeInstanceOf(Date);
    });

    it('sets publication time when published', () => {
      const version = createVersion();

      version.submitForReview();
      const beforePublish = new Date();

      version.publish();

      const publishedAt = version.publishedAt;

      expect(publishedAt).toBeInstanceOf(Date);

      if (publishedAt === null) {
        throw new Error(
          'Expected publishedAt to be populated after publication.',
        );
      }

      expect(publishedAt.getTime()).toBeGreaterThanOrEqual(
        beforePublish.getTime(),
      );
    });

    it('archives a draft version', () => {
      const version = createVersion();

      version.archive();

      expect(version.status).toBe('ARCHIVED');
    });

    it('archives an in-review version', () => {
      const version = createVersion();

      version.submitForReview();
      version.archive();

      expect(version.status).toBe('ARCHIVED');
    });

    it('archives a published version', () => {
      const version = createVersion();

      version.submitForReview();
      version.publish();
      version.archive();

      expect(version.status).toBe('ARCHIVED');
    });
  });

  describe('immutability', () => {
    it('does not allow metadata changes after review submission', () => {
      const version = createVersion();

      version.submitForReview();

      expect(() =>
        version.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);
    });

    it('does not allow metadata changes after publication', () => {
      const version = createVersion();

      version.submitForReview();
      version.publish();

      expect(() =>
        version.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);
    });

    it('does not allow metadata changes after archival', () => {
      const version = createVersion();

      version.archive();

      expect(() =>
        version.updateMetadata({
          title: 'Should Not Change',
        }),
      ).toThrow(CourseValidationError);
    });

    it('does not allow publishing directly from DRAFT', () => {
      const version = createVersion();

      expect(() => version.publish()).toThrow(
        CourseValidationError,
      );
    });

    it('does not allow publishing twice', () => {
      const version = createVersion();

      version.submitForReview();
      version.publish();

      expect(() => version.publish()).toThrow(
        CourseValidationError,
      );
    });

    it('does not allow submitting an archived version for review', () => {
      const version = createVersion();

      version.archive();

      expect(() => version.submitForReview()).toThrow(
        CourseValidationError,
      );
    });

    it('does not allow archiving an archived version', () => {
      const version = createVersion();

      version.archive();

      expect(() => version.archive()).toThrow(
        CourseValidationError,
      );
    });
  });

  describe('helpers', () => {
    it('reports publication state correctly', () => {
      const version = createVersion();

      expect(version.isPublished()).toBe(false);

      version.submitForReview();
      version.publish();

      expect(version.isPublished()).toBe(true);
    });

    it('reports mutability correctly', () => {
      const version = createVersion();

      expect(version.isMutable()).toBe(true);

      version.submitForReview();

      expect(version.isMutable()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('returns detached date values', () => {
      const version = createVersion();

      const primitives = version.toPrimitives();

      expect(primitives.id).toBe(version.id);
      expect(primitives.createdAt).not.toBe(version.createdAt);
      expect(primitives.updatedAt).not.toBe(version.updatedAt);
      expect(primitives.publishedAt).toBeNull();
    });
  });

  describe('rehydration', () => {
    it('preserves identity and state', () => {
      const version = createVersion();

      version.submitForReview();
      version.publish();

      const rehydrated = CourseVersion.rehydrate(
        version.toPrimitives(),
      );

      expect(rehydrated.id.equals(version.id)).toBe(true);
      expect(rehydrated.courseId).toBe(version.courseId);
      expect(rehydrated.version).toBe(version.version);
      expect(rehydrated.status).toBe('PUBLISHED');
      expect(rehydrated.publishedAt).toEqual(
        version.publishedAt,
      );
    });
  });
});