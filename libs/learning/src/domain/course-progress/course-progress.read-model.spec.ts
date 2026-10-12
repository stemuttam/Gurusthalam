import { describe, expect, it } from 'vitest';

import {
  createCourseProgressReadModel,
  CourseProgressReadModelValidationError,
} from './course-progress.read-model.js';

import type { CourseProgressAggregationResult } from './course-progress-aggregation.policy.js';

const aggregation: CourseProgressAggregationResult = {
  courseVersionId: 'course-version-1',
  totalLearningUnits: 4,
  startedLearningUnits: 2,
  completedLearningUnits: 1,
  percentage: 38,
  hasLearningUnits: true,
};

const calculatedAt = new Date('2026-10-12T08:00:00.000Z');

describe('createCourseProgressReadModel', () => {
  it('creates an enrollment-scoped read model from the aggregation result', () => {
    expect(
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation,
        calculatedAt,
      }),
    ).toEqual({
      enrollmentId: 'enrollment-1',
      courseVersionId: 'course-version-1',
      totalLearningUnits: 4,
      startedLearningUnits: 2,
      completedLearningUnits: 1,
      percentage: 38,
      hasLearningUnits: true,
      calculatedAt,
    });
  });

  it('copies the calculation timestamp instead of reusing the Date object', () => {
    const result = createCourseProgressReadModel({
      enrollmentId: 'enrollment-1',
      aggregation,
      calculatedAt,
    });

    expect(result.calculatedAt).not.toBe(calculatedAt);
    expect(result.calculatedAt.getTime()).toBe(calculatedAt.getTime());
  });

  it('preserves 100 percent without inventing completed lifecycle state', () => {
    const result = createCourseProgressReadModel({
      enrollmentId: 'enrollment-1',
      aggregation: {
        ...aggregation,
        totalLearningUnits: 1,
        startedLearningUnits: 1,
        completedLearningUnits: 0,
        percentage: 100,
      },
      calculatedAt,
    });

    expect(result.percentage).toBe(100);
    expect(result.completedLearningUnits).toBe(0);
  });

  it('supports an empty Course Structure', () => {
    const result = createCourseProgressReadModel({
      enrollmentId: 'enrollment-empty',
      aggregation: {
        courseVersionId: 'course-version-empty',
        totalLearningUnits: 0,
        startedLearningUnits: 0,
        completedLearningUnits: 0,
        percentage: 0,
        hasLearningUnits: false,
      },
      calculatedAt,
    });

    expect(result.hasLearningUnits).toBe(false);
    expect(result.totalLearningUnits).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('rejects a blank enrollment identifier', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: ' ',
        aggregation,
        calculatedAt,
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });

  it('rejects completed counts greater than started counts', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation: {
          ...aggregation,
          startedLearningUnits: 1,
          completedLearningUnits: 2,
        },
        calculatedAt,
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });

  it('rejects counts greater than the total number of LearningUnits', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation: {
          ...aggregation,
          totalLearningUnits: 1,
          startedLearningUnits: 2,
          completedLearningUnits: 1,
        },
        calculatedAt,
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });

  it('rejects an invalid percentage', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation: { ...aggregation, percentage: 101 },
        calculatedAt,
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });

  it('rejects inconsistent empty-structure metadata', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation: {
          courseVersionId: 'course-version-empty',
          totalLearningUnits: 0,
          startedLearningUnits: 0,
          completedLearningUnits: 0,
          percentage: 0,
          hasLearningUnits: true,
        },
        calculatedAt,
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });

  it('rejects an invalid calculation timestamp', () => {
    expect(() =>
      createCourseProgressReadModel({
        enrollmentId: 'enrollment-1',
        aggregation,
        calculatedAt: new Date(Number.NaN),
      }),
    ).toThrow(CourseProgressReadModelValidationError);
  });
});
