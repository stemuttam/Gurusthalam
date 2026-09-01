/**
 * Delivery model of a Course.
 *
 * CourseType describes how learners consume the course experience.
 * It does not describe subject taxonomy, difficulty, or lifecycle.
 */
export const CourseType = {
  SELF_PACED: 'SELF_PACED',
  LIVE: 'LIVE',
  BLENDED: 'BLENDED',
} as const;

export type CourseType = (typeof CourseType)[keyof typeof CourseType];

export const COURSE_TYPES = Object.values(CourseType) as readonly CourseType[];

export function isCourseType(value: unknown): value is CourseType {
  return (
    typeof value === 'string' &&
    COURSE_TYPES.includes(value as CourseType)
  );
}