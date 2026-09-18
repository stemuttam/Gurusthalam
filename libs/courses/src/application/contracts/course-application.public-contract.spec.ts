import { describe, expect, it } from 'vitest';

import {
  assignCourseOwnershipInputSchema,
  courseLifecycleCommandInputSchema,
  publishCourseInputSchema,
  removeCourseOwnershipInputSchema,
  replaceCourseOwnershipInputSchema,
  submitCourseForReviewInputSchema,
} from '../../index.js';

import type {
  AssignCourseOwnershipInput,
  CourseLifecycleCommandInputSchema,
  CourseOwnershipAssignmentInput,
  PublishCourseInput,
  RemoveCourseOwnershipInput,
  ReplaceCourseOwnershipInput,
  SubmitCourseForReviewInput,
} from '../../index.js';

describe('Course application public contract — 4.8-E', () => {
  it('exports workflow and ownership runtime schemas from the public Course barrel', () => {
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

  it('keeps lifecycle application schemas authorization-independent at the public boundary', () => {
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

  it('exposes the new ownership and workflow input types through the public Course barrel', () => {
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
  });
});
