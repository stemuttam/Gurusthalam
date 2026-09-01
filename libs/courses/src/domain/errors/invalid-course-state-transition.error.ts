import type { CourseStatus as CourseStatusValue } from '../enums/course-status.js';

import {
  CourseDomainError,
  CourseDomainErrorCode,
} from './course-domain.error.js';

export class InvalidCourseStateTransitionError extends CourseDomainError {
  readonly from: CourseStatusValue;
  readonly to: CourseStatusValue;

  constructor(
    from: CourseStatusValue,
    to: CourseStatusValue,
    options?: ErrorOptions,
  ) {
    super(
      `Invalid Course status transition from "${from}" to "${to}".`,
      CourseDomainErrorCode.INVALID_STATE_TRANSITION,
      options,
    );

    this.name = 'InvalidCourseStateTransitionError';
    this.from = from;
    this.to = to;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}