import { describe, expect, it } from 'vitest';

import {
  assignCourseOwnershipInputSchema,
  courseLifecycleCommandInputSchema,
  publishCourseInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  submitCourseForReviewInputSchema,
  updateCourseInputSchema,
} from '../../index.js';

import type {
  AssignCourseOwnershipInput,
  CourseLifecycleCommandInputSchema,
  CourseOwnershipAssignmentInput,
  PublishCourseInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  SubmitCourseForReviewInput,
  UpdateCourseInput,
} from '../../index.js';

describe('Course application public contract — 4.10-B', () => {
  it('exports workflow, ownership, and update runtime schemas from the public Course barrel', () => {
    expect(
      courseLifecycleCommandInputSchema.parse({ courseId: 'course-001' }),
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

  it('keeps lifecycle and update application schemas authorization-independent at the public boundary', () => {
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

    expect(() =>
      updateCourseInputSchema.parse({
        courseId: 'course-001',
        title: 'Updated Course',
        actorId: 'actor-001',
      }),
    ).toThrow();

    expect(() =>
      updateCourseInputSchema.parse({
        courseId: 'course-001',
      }),
    ).toThrow('At least one Course metadata field must be provided.');
  });

  it('exposes ownership, workflow, and update input types through the public Course barrel', () => {
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

    const publishInput: PublishCourseInput = {
      courseId: 'course-001',
    };

    const lifecycleInput: CourseLifecycleCommandInputSchema = {
      courseId: 'course-001',
    };

    const updateInput: UpdateCourseInput = {
      courseId: 'course-001',
      title: 'Updated Course',
    };

    expect(assignment).toEqual({
      principalId: 'actor-001',
      role: 'AUTHOR',
    });

    expect(assignInput.courseId).toBe('course-001');
    expect(removeInput.courseId).toBe('course-001');
    expect(replaceInput.courseId).toBe('course-001');
    expect(submitInput.courseId).toBe('course-001');
    expect(publishInput.courseId).toBe('course-001');
    expect(lifecycleInput.courseId).toBe('course-001');
    expect(updateInput.courseId).toBe('course-001');
    expect(updateInput.title).toBe('Updated Course');
  });
});
