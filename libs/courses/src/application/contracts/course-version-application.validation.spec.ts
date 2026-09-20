import { describe, expect, it } from 'vitest';

import {
  createCourseVersionInputSchema,
  publishCourseVersionInputSchema,
} from './course-version-application.validation.js';

describe('CourseVersion application validation contracts', () => {
  describe('createCourseVersionInputSchema', () => {
    it('accepts a valid course identifier', () => {
      const result = createCourseVersionInputSchema.parse({
        courseId: 'course-123',
      });

      expect(result).toEqual({
        courseId: 'course-123',
      });
    });

    it('trims the course identifier', () => {
      const result = createCourseVersionInputSchema.parse({
        courseId: '  course-123  ',
      });

      expect(result.courseId).toBe('course-123');
    });

    it('rejects an empty course identifier', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only course identifier', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: '   ',
        }),
      ).toThrow();
    });

    it('rejects unexpected fields', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-123',
          version: 2,
        }),
      ).toThrow();
    });

    it('does not accept a caller-selected status', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-123',
          status: 'PUBLISHED',
        }),
      ).toThrow();
    });

    it('does not accept a caller-selected version number', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-123',
          version: 7,
        }),
      ).toThrow();
    });

    it('does not accept a caller-selected metadata snapshot', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-123',
          title: 'Caller supplied title',
        }),
      ).toThrow();
    });
  });

  describe('publishCourseVersionInputSchema', () => {
    it('accepts a valid CourseVersion identifier', () => {
      const result = publishCourseVersionInputSchema.parse({
        courseVersionId: 'course-version-123',
      });

      expect(result).toEqual({
        courseVersionId: 'course-version-123',
      });
    });

    it('trims the CourseVersion identifier', () => {
      const result = publishCourseVersionInputSchema.parse({
        courseVersionId: '  course-version-123  ',
      });

      expect(result.courseVersionId).toBe('course-version-123');
    });

    it('rejects an empty CourseVersion identifier', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: '',
        }),
      ).toThrow();
    });

    it('rejects a whitespace-only CourseVersion identifier', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: '   ',
        }),
      ).toThrow();
    });

    it('rejects unexpected fields', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-123',
          status: 'PUBLISHED',
        }),
      ).toThrow();
    });

    it('does not accept a caller-selected publication timestamp', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-123',
          publishedAt: new Date(),
        }),
      ).toThrow();
    });

    it('does not accept authorization fields', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-123',
          actorId: 'actor-123',
        }),
      ).toThrow();
    });

    it('does not accept caller-controlled lifecycle state', () => {
      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-123',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        }),
      ).toThrow();
    });
  });
});
