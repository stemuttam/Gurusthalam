import { describe, expect, it } from 'vitest';

import {
  Course,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseValidationError,
  CourseVisibility,
} from '../../index.js';

describe('Course metadata mutation eligibility boundary', () => {
  const createCourse = () =>
    Course.create({
      title: 'Original Course Title',
      description: 'Original course description',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: 'instructor-1',
    });

  const metadataUpdate = {
    title: 'Updated Course Title',
    description: 'Updated course description',
    level: CourseLevel.INTERMEDIATE,
    type: CourseType.BLENDED,
    visibility: CourseVisibility.UNLISTED,
  };

  const moveToInReview = (course: Course): void => {
    course.submitForReview();
  };

  const moveToPublished = (course: Course): void => {
    course.submitForReview();
    course.publish();
  };

  const moveToUnpublished = (course: Course): void => {
    course.submitForReview();
    course.publish();
    course.unpublish();
  };

  const moveToArchived = (course: Course): void => {
    course.submitForReview();
    course.publish();
    course.archive();
  };

  describe('DRAFT eligibility', () => {
    it('allows metadata mutation while the course is DRAFT', () => {
      const course = createCourse();

      expect(course.status).toBe(CourseStatus.DRAFT);

      expect(() => course.updateMetadata(metadataUpdate)).not.toThrow();

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.title).toBe('Updated Course Title');
      expect(course.description).toBe('Updated course description');
      expect(course.level).toBe(CourseLevel.INTERMEDIATE);
      expect(course.type).toBe(CourseType.BLENDED);
      expect(course.visibility).toBe(CourseVisibility.UNLISTED);
    });

    it('keeps the course in DRAFT after successful metadata mutation', () => {
      const course = createCourse();

      course.updateMetadata({
        title: 'Draft Mutation',
      });

      expect(course.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('IN_REVIEW ineligibility', () => {
    it('rejects metadata mutation while the course is IN_REVIEW', () => {
      const course = createCourse();

      moveToInReview(course);

      expect(course.status).toBe(CourseStatus.IN_REVIEW);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves aggregate state after rejecting an IN_REVIEW mutation', () => {
      const course = createCourse();

      moveToInReview(course);

      const before = course.toPrimitives();
      const beforeEvents = course.getDomainEvents();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.toPrimitives()).toEqual(before);
      expect(course.getDomainEvents()).toEqual(beforeEvents);
      expect(course.getDomainEvents()).toHaveLength(beforeEvents.length);
    });
  });

  describe('PUBLISHED ineligibility', () => {
    it('rejects metadata mutation while the course is PUBLISHED', () => {
      const course = createCourse();

      moveToPublished(course);

      expect(course.status).toBe(CourseStatus.PUBLISHED);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves aggregate state after rejecting a PUBLISHED mutation', () => {
      const course = createCourse();

      moveToPublished(course);

      const before = course.toPrimitives();
      const beforeEvents = course.getDomainEvents();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.toPrimitives()).toEqual(before);
      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });
  });

  describe('UNPUBLISHED ineligibility', () => {
    it('rejects metadata mutation while the course is UNPUBLISHED', () => {
      const course = createCourse();

      moveToUnpublished(course);

      expect(course.status).toBe(CourseStatus.UNPUBLISHED);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves aggregate state after rejecting an UNPUBLISHED mutation', () => {
      const course = createCourse();

      moveToUnpublished(course);

      const before = course.toPrimitives();
      const beforeEvents = course.getDomainEvents();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.toPrimitives()).toEqual(before);
      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });
  });

  describe('ARCHIVED ineligibility', () => {
    it('rejects metadata mutation while the course is ARCHIVED', () => {
      const course = createCourse();

      moveToArchived(course);

      expect(course.status).toBe(CourseStatus.ARCHIVED);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );
    });

    it('preserves aggregate state after rejecting an ARCHIVED mutation', () => {
      const course = createCourse();

      moveToArchived(course);

      const before = course.toPrimitives();
      const beforeEvents = course.getDomainEvents();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.toPrimitives()).toEqual(before);
      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });
  });

  describe('failure boundary', () => {
    it('does not mutate updatedAt when metadata mutation is rejected', () => {
      const course = createCourse();

      moveToInReview(course);

      const beforeUpdatedAt = course.updatedAt.getTime();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.updatedAt.getTime()).toBe(beforeUpdatedAt);
    });

    it('does not append a metadata event when mutation is rejected', () => {
      const course = createCourse();

      moveToInReview(course);

      const beforeEvents = course.getDomainEvents();

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.getDomainEvents()).toEqual(beforeEvents);
    });

    it('preserves aggregate identity when mutation is rejected', () => {
      const course = createCourse();

      const beforeId = course.id.toString();

      moveToInReview(course);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.id.toString()).toBe(beforeId);
    });

    it('preserves createdAt when mutation is rejected', () => {
      const course = createCourse();

      const beforeCreatedAt = course.createdAt.getTime();

      moveToInReview(course);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(course.createdAt.getTime()).toBe(beforeCreatedAt);
    });

    it('leaves the aggregate usable after a rejected mutation', () => {
      const course = createCourse();

      moveToInReview(course);

      expect(() => course.updateMetadata(metadataUpdate)).toThrow(
        CourseValidationError,
      );

      expect(() => course.publish()).not.toThrow();
      expect(course.status).toBe(CourseStatus.PUBLISHED);
    });
  });
});