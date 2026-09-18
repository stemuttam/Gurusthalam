import { describe, expect, it } from 'vitest';

import {
  assignCourseOwnershipInputSchema,
  courseLifecycleCommandInputSchema,
  DefaultCourseApplicationService,
  publishCourseInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  submitCourseForReviewInputSchema,
} from '@gurusthalam/courses';

import type {
  AssignCourseOwnershipInput,
  CourseLifecycleCommandInputSchema,
  PublishCourseInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  SubmitCourseForReviewInput,
} from '@gurusthalam/courses';

describe('Course application package consumer contract — 4.8-E', () => {
  it('resolves the complete public workflow and ownership runtime API from @gurusthalam/courses', () => {
    expect(DefaultCourseApplicationService).toBeDefined();

    expect(assignCourseOwnershipInputSchema).toBeDefined();
    expect(courseLifecycleCommandInputSchema).toBeDefined();
    expect(publishCourseInputSchema).toBeDefined();
    expect(removeCourseOwnershipInputSchema).toBeDefined();
    expect(replaceCourseOwnershipInputSchema).toBeDefined();
    expect(submitCourseForReviewInputSchema).toBeDefined();
  });

  it('validates the public workflow commands through the package boundary', () => {
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
      publishCourseInputSchema.parse({
        courseId: 'course-001',
      }),
    ).toEqual({
      courseId: 'course-001',
    });
  });

  it('validates the public ownership commands through the package boundary', () => {
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
          {
            principalId: 'actor-002',
            role: 'EDITOR',
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
        {
          principalId: 'actor-002',
          role: 'EDITOR',
        },
      ],
    });
  });

  it('keeps public lifecycle commands authorization-independent', () => {
    expect(() =>
      submitCourseForReviewInputSchema.parse({
        courseId: 'course-001',
        actorId: 'actor-001',
      }),
    ).toThrow();

    expect(() =>
      publishCourseInputSchema.parse({
        courseId: 'course-001',
        permission: 'COURSE_PUBLISH',
      }),
    ).toThrow();

    expect(() =>
      courseLifecycleCommandInputSchema.parse({
        courseId: 'course-001',
        role: 'PUBLISHER',
      }),
    ).toThrow();
  });

  it('compiles the required public application input types', () => {
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
      assignments: [
        {
          principalId: 'actor-001',
          role: 'AUTHOR',
        },
      ],
    };

    const submitInput: SubmitCourseForReviewInput = {
      courseId: 'course-001',
    };

    const publishInput: PublishCourseInput = {
      courseId: 'course-001',
    };

    const lifecycleInput: CourseLifecycleCommandInputSchema = {
      courseId: 'course-001',
    };

    expect(assignInput.courseId).toBe('course-001');
    expect(removeInput.courseId).toBe('course-001');
    expect(replaceInput.courseId).toBe('course-001');
    expect(submitInput.courseId).toBe('course-001');
    expect(publishInput.courseId).toBe('course-001');
    expect(lifecycleInput.courseId).toBe('course-001');
  });
});
