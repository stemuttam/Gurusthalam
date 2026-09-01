/**
 * Difficulty / learner-experience level of a Course.
 *
 * ALL_LEVELS represents courses intentionally designed for learners
 * across multiple experience levels.
 */
export const CourseLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ALL_LEVELS: 'ALL_LEVELS',
} as const;

export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const COURSE_LEVELS = Object.values(CourseLevel) as readonly CourseLevel[];

export function isCourseLevel(value: unknown): value is CourseLevel {
  return (
    typeof value === 'string' &&
    COURSE_LEVELS.includes(value as CourseLevel)
  );
}