import { describe, expect, it } from 'vitest';

import {
  assignCourseOwnershipInputSchema,
  courseExistsInputSchema,
  courseIdInputSchema,
  courseLifecycleCommandInputSchema,
  createCourseInputSchema,
  createCourseVersionInputSchema,
  getCourseInputSchema,
  publishCourseInputSchema,
  publishCourseVersionInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  requestCourseChangesInputSchema,
  submitCourseForReviewInputSchema,
  updateCourseInputSchema,
  updateMetadataInputSchema,
} from '../../index.js';

import type {
  AssignCourseOwnershipInput,
  CourseApplicationService,
  CourseExistsInputSchema,
  CourseLifecycleCommandInputSchema,
  CourseOwnershipAssignmentInput,
  CreateCourseInput,
  CreateCourseVersionInput,
  GetCourseInput,
  PublishCourseInput,
  PublishCourseVersionInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  RequestCourseChangesInput,
  SaveCourseInput,
  SubmitCourseForReviewInput,
  UpdateCourseInput,
  UpdateMetadataInput,
} from '../../index.js';

import type { CourseVersionApplicationService } from '../../index.js';

describe('Course application public contract regression — 4.10-J', () => {
  describe('Course runtime schema exports', () => {
    it('exports every Course application runtime schema from the public barrel', () => {
      expect(courseIdInputSchema.parse('course-001')).toBe('course-001');

      expect(
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          description: 'Learn the fundamentals of physics.',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PRIVATE',
          instructorId: 'instructor-001',
        }),
      ).toEqual({
        title: 'Introduction to Physics',
        description: 'Learn the fundamentals of physics.',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PRIVATE',
        instructorId: 'instructor-001',
      });

      expect(
        getCourseInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        courseExistsInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        updateCourseInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
        }),
      ).toEqual({
        courseId: 'course-001',
        title: 'Updated Course',
      });

      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
        }),
      ).toEqual({
        courseId: 'course-001',
        title: 'Updated Course',
      });

      expect(
        assignCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          principalId: 'actor-001',
          role: 'AUTHOR',
        }),
      ).toEqual({
        courseId: 'course-001',
        principalId: 'actor-001',
        role: 'AUTHOR',
      });

      expect(
        removeCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          principalId: 'actor-001',
          role: 'AUTHOR',
        }),
      ).toEqual({
        courseId: 'course-001',
        principalId: 'actor-001',
        role: 'AUTHOR',
      });

      expect(
        replaceCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          assignments: [
            {
              principalId: 'actor-001',
              role: 'OWNER',
            },
          ],
        }),
      ).toEqual({
        courseId: 'course-001',
        assignments: [
          {
            principalId: 'actor-001',
            role: 'OWNER',
          },
        ],
      });

      expect(
        courseLifecycleCommandInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        submitCourseForReviewInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        requestCourseChangesInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        publishCourseInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });
    });

    it('exports every CourseVersion application runtime schema from the public barrel', () => {
      expect(
        createCourseVersionInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toEqual({
        courseId: 'course-001',
      });

      expect(
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-001',
        }),
      ).toEqual({
        courseVersionId: 'course-version-001',
      });
    });

    it('keeps updateMetadata and updateCourse on the same runtime contract', () => {
      expect(updateMetadataInputSchema).toBe(updateCourseInputSchema);
    });
  });

  describe('strict public command boundaries', () => {
    it('rejects authorization concerns from Course workflow commands', () => {
      expect(() =>
        submitCourseForReviewInputSchema.parse({
          courseId: 'course-001',
          actorId: 'actor-001',
        }),
      ).toThrow();

      expect(() =>
        requestCourseChangesInputSchema.parse({
          courseId: 'course-001',
          role: 'REVIEWER',
        }),
      ).toThrow();

      expect(() =>
        publishCourseInputSchema.parse({
          courseId: 'course-001',
          permission: 'COURSE_PUBLISH',
        }),
      ).toThrow();
    });

    it('rejects authorization concerns from Course metadata commands', () => {
      expect(() =>
        updateCourseInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
          actorId: 'actor-001',
        }),
      ).toThrow();

      expect(() =>
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
          permission: 'COURSE_UPDATE',
        }),
      ).toThrow();
    });

    it('rejects authorization concerns from ownership commands', () => {
      expect(() =>
        assignCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          principalId: 'actor-001',
          role: 'AUTHOR',
          actorId: 'actor-002',
        }),
      ).toThrow();

      expect(() =>
        removeCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          principalId: 'actor-001',
          role: 'AUTHOR',
          permission: 'COURSE_OWNERSHIP_REMOVE',
        }),
      ).toThrow();

      expect(() =>
        replaceCourseOwnershipInputSchema.parse({
          courseId: 'course-001',
          assignments: [],
          actorId: 'actor-002',
        }),
      ).toThrow();
    });

    it('rejects authorization concerns from CourseVersion commands', () => {
      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-001',
          actorId: 'actor-001',
        }),
      ).toThrow();

      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-001',
          permission: 'COURSE_VERSION_PUBLISH',
        }),
      ).toThrow();
    });

    it('rejects caller-controlled lifecycle and persistence state', () => {
      expect(() =>
        createCourseInputSchema.parse({
          title: 'Introduction to Physics',
          description: 'Learn the fundamentals of physics.',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          instructorId: 'instructor-001',
          status: 'PUBLISHED',
        } as never),
      ).toThrow();

      expect(() =>
        updateCourseInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
          status: 'PUBLISHED',
        } as never),
      ).toThrow();

      expect(() =>
        createCourseVersionInputSchema.parse({
          courseId: 'course-001',
          version: 7,
          status: 'PUBLISHED',
        } as never),
      ).toThrow();

      expect(() =>
        publishCourseVersionInputSchema.parse({
          courseVersionId: 'course-version-001',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        } as never),
      ).toThrow();
    });
  });

  describe('metadata contract semantics', () => {
    it('requires at least one mutable metadata field', () => {
      expect(() =>
        updateCourseInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toThrow('At least one Course metadata field must be provided.');

      expect(() =>
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
        }),
      ).toThrow('At least one Course metadata field must be provided.');
    });

    it('allows every supported mutable metadata field independently', () => {
      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          title: 'Updated Course',
        }),
      ).toEqual({
        courseId: 'course-001',
        title: 'Updated Course',
      });

      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          description: 'Updated description.',
        }),
      ).toEqual({
        courseId: 'course-001',
        description: 'Updated description.',
      });

      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          level: 'ADVANCED',
        }),
      ).toEqual({
        courseId: 'course-001',
        level: 'ADVANCED',
      });

      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          type: 'BLENDED',
        }),
      ).toEqual({
        courseId: 'course-001',
        type: 'BLENDED',
      });

      expect(
        updateMetadataInputSchema.parse({
          courseId: 'course-001',
          visibility: 'PUBLIC',
        }),
      ).toEqual({
        courseId: 'course-001',
        visibility: 'PUBLIC',
      });
    });
  });

  describe('TypeScript public contract compatibility', () => {
    it('keeps Course input types aligned with their public schemas', () => {
      const createInput: CreateCourseInput = {
        title: 'Introduction to Physics',
        description: 'Learn the fundamentals of physics.',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        visibility: 'PRIVATE',
        instructorId: 'instructor-001',
      };

      const getInput: GetCourseInput = {
        courseId: 'course-001',
      };

      const existsInput: CourseExistsInputSchema = {
        courseId: 'course-001',
      };

      const lifecycleInput: CourseLifecycleCommandInputSchema = {
        courseId: 'course-001',
      };

      const updateInput: UpdateCourseInput = {
        courseId: 'course-001',
        title: 'Updated Course',
      };

      const metadataInput: UpdateMetadataInput = {
        courseId: 'course-001',
        description: 'Updated description.',
      };

      const assignment: CourseOwnershipAssignmentInput = {
        principalId: 'actor-001',
        role: 'AUTHOR',
      };

      const assignInput: AssignCourseOwnershipInput = {
        courseId: 'course-001',
        principalId: 'actor-001',
        role: 'AUTHOR',
      };

      const removeInput: RemoveCourseOwnershipInput = {
        courseId: 'course-001',
        principalId: 'actor-001',
        role: 'AUTHOR',
      };

      const replaceInput: ReplaceCourseOwnershipInput = {
        courseId: 'course-001',
        assignments: [assignment],
      };

      const submitInput: SubmitCourseForReviewInput = {
        courseId: 'course-001',
      };

      const requestChangesInput: RequestCourseChangesInput = {
        courseId: 'course-001',
      };

      const publishInput: PublishCourseInput = {
        courseId: 'course-001',
      };

      const saveInput = null as unknown as SaveCourseInput;

      expect(createInput.title).toBe('Introduction to Physics');
      expect(getInput.courseId).toBe('course-001');
      expect(existsInput.courseId).toBe('course-001');
      expect(lifecycleInput.courseId).toBe('course-001');
      expect(updateInput.title).toBe('Updated Course');
      expect(metadataInput.description).toBe('Updated description.');
      expect(assignment.role).toBe('AUTHOR');
      expect(assignInput.principalId).toBe('actor-001');
      expect(removeInput.role).toBe('AUTHOR');
      expect(replaceInput.assignments).toHaveLength(1);
      expect(submitInput.courseId).toBe('course-001');
      expect(requestChangesInput.courseId).toBe('course-001');
      expect(publishInput.courseId).toBe('course-001');

      expect(saveInput).toBeNull();
    });

    it('keeps CourseVersion input types aligned with their public schemas', () => {
      const createVersionInput: CreateCourseVersionInput = {
        courseId: 'course-001',
      };

      const publishVersionInput: PublishCourseVersionInput = {
        courseVersionId: 'course-version-001',
      };

      expect(createVersionInput.courseId).toBe('course-001');
      expect(publishVersionInput.courseVersionId).toBe('course-version-001');
    });

    it('keeps the Course application service public contract type complete', () => {
      const acceptService = (
        service: CourseApplicationService,
      ): CourseApplicationService => service;

      expect(acceptService).toBeTypeOf('function');
    });

    it('keeps the CourseVersion application service public contract type complete', () => {
      const acceptService = (
        service: CourseVersionApplicationService,
      ): CourseVersionApplicationService => service;

      expect(acceptService).toBeTypeOf('function');
    });
  });
});
