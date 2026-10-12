import { describe, expect, it } from 'vitest';

import {
  calculateCourseProgress,
  CourseProgressAggregationValidationError,
  CourseProgressSourceStatus as Status,
  type CalculateCourseProgressInput,
} from './course-progress-aggregation.policy.js';

const baseInput: CalculateCourseProgressInput = {
  courseVersionId: 'course-version-1',
  learningUnits: [
    { learningUnitId: 'unit-1' },
    { learningUnitId: 'unit-2' },
    { learningUnitId: 'unit-3' },
    { learningUnitId: 'unit-4' },
  ],
  lessonProgress: [
    {
      learningUnitId: 'unit-1',
      status: Status.COMPLETED,
      percentage: 100,
    },
    {
      learningUnitId: 'unit-2',
      status: Status.IN_PROGRESS,
      percentage: 50,
    },
  ],
};

describe('calculateCourseProgress', () => {
  it('uses all structure LearningUnits as the denominator', () => {
    expect(calculateCourseProgress(baseInput)).toEqual({
      courseVersionId: 'course-version-1',
      totalLearningUnits: 4,
      startedLearningUnits: 2,
      completedLearningUnits: 1,
      percentage: 38,
      hasLearningUnits: true,
    });
  });

  it('treats missing LessonProgress records as zero percent', () => {
    const result = calculateCourseProgress({
      courseVersionId: 'version-a',
      learningUnits: [{ learningUnitId: 'one' }, { learningUnitId: 'two' }],
      lessonProgress: [
        {
          learningUnitId: 'one',
          status: Status.COMPLETED,
          percentage: 100,
        },
      ],
    });

    expect(result.percentage).toBe(50);
    expect(result.totalLearningUnits).toBe(2);
    expect(result.completedLearningUnits).toBe(1);
  });

  it('returns zero percent for an empty structure', () => {
    expect(
      calculateCourseProgress({
        courseVersionId: 'version-empty',
        learningUnits: [],
        lessonProgress: [],
      }),
    ).toEqual({
      courseVersionId: 'version-empty',
      totalLearningUnits: 0,
      startedLearningUnits: 0,
      completedLearningUnits: 0,
      percentage: 0,
      hasLearningUnits: false,
    });
  });

  it('rounds the mean percentage to the nearest integer', () => {
    const result = calculateCourseProgress({
      courseVersionId: 'version-round',
      learningUnits: [
        { learningUnitId: 'one' },
        { learningUnitId: 'two' },
        { learningUnitId: 'three' },
      ],
      lessonProgress: [
        {
          learningUnitId: 'one',
          status: Status.IN_PROGRESS,
          percentage: 50,
        },
        {
          learningUnitId: 'two',
          status: Status.IN_PROGRESS,
          percentage: 50,
        },
        {
          learningUnitId: 'three',
          status: Status.NOT_STARTED,
          percentage: 0,
        },
      ],
    });

    expect(result.percentage).toBe(33);
  });

  it('does not count IN_PROGRESS at 100 percent as completed', () => {
    const result = calculateCourseProgress({
      courseVersionId: 'version-lifecycle',
      learningUnits: [{ learningUnitId: 'one' }],
      lessonProgress: [
        {
          learningUnitId: 'one',
          status: Status.IN_PROGRESS,
          percentage: 100,
        },
      ],
    });

    expect(result.percentage).toBe(100);
    expect(result.startedLearningUnits).toBe(1);
    expect(result.completedLearningUnits).toBe(0);
  });

  it('does not count SectionProgress separately', () => {
    const result = calculateCourseProgress({
      courseVersionId: 'version-no-double-count',
      learningUnits: [{ learningUnitId: 'one' }, { learningUnitId: 'two' }],
      lessonProgress: [
        {
          learningUnitId: 'one',
          status: Status.COMPLETED,
          percentage: 100,
        },
      ],
    });

    expect(result.totalLearningUnits).toBe(2);
    expect(result.percentage).toBe(50);
  });

  it('rejects duplicate structure LearningUnit identifiers', () => {
    expect(() =>
      calculateCourseProgress({
        courseVersionId: 'version-duplicate-structure',
        learningUnits: [{ learningUnitId: 'same' }, { learningUnitId: 'same' }],
        lessonProgress: [],
      }),
    ).toThrow(CourseProgressAggregationValidationError);
  });

  it('rejects duplicate LessonProgress states for one LearningUnit', () => {
    expect(() =>
      calculateCourseProgress({
        courseVersionId: 'version-duplicate-progress',
        learningUnits: [{ learningUnitId: 'one' }],
        lessonProgress: [
          {
            learningUnitId: 'one',
            status: Status.IN_PROGRESS,
            percentage: 20,
          },
          {
            learningUnitId: 'one',
            status: Status.IN_PROGRESS,
            percentage: 40,
          },
        ],
      }),
    ).toThrow(CourseProgressAggregationValidationError);
  });

  it('rejects progress for a LearningUnit outside the structure', () => {
    expect(() =>
      calculateCourseProgress({
        courseVersionId: 'version-mismatch',
        learningUnits: [{ learningUnitId: 'current-unit' }],
        lessonProgress: [
          {
            learningUnitId: 'foreign-unit',
            status: Status.COMPLETED,
            percentage: 100,
          },
        ],
      }),
    ).toThrow(CourseProgressAggregationValidationError);
  });

  it('rejects invalid percentages', () => {
    for (const percentage of [-1, 101, 1.5, Number.NaN]) {
      expect(() =>
        calculateCourseProgress({
          courseVersionId: 'version-invalid-percentage',
          learningUnits: [{ learningUnitId: 'one' }],
          lessonProgress: [
            {
              learningUnitId: 'one',
              status: Status.IN_PROGRESS,
              percentage,
            },
          ],
        }),
      ).toThrow(CourseProgressAggregationValidationError);
    }
  });

  it('rejects invalid status-percentage combinations', () => {
    expect(() =>
      calculateCourseProgress({
        courseVersionId: 'version-invalid-state',
        learningUnits: [{ learningUnitId: 'one' }],
        lessonProgress: [
          {
            learningUnitId: 'one',
            status: Status.COMPLETED,
            percentage: 90,
          },
        ],
      }),
    ).toThrow(CourseProgressAggregationValidationError);

    expect(() =>
      calculateCourseProgress({
        courseVersionId: 'version-invalid-state-2',
        learningUnits: [{ learningUnitId: 'one' }],
        lessonProgress: [
          {
            learningUnitId: 'one',
            status: Status.NOT_STARTED,
            percentage: 10,
          },
        ],
      }),
    ).toThrow(CourseProgressAggregationValidationError);
  });

  it('rejects blank identifiers', () => {
    expect(() =>
      calculateCourseProgress({
        courseVersionId: '   ',
        learningUnits: [],
        lessonProgress: [],
      }),
    ).toThrow(CourseProgressAggregationValidationError);
  });

  it('does not mutate the supplied input', () => {
    const input = structuredClone(baseInput);

    calculateCourseProgress(input);

    expect(input).toEqual(baseInput);
  });
});
