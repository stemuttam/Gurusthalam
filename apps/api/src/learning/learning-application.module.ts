import { Module } from '@nestjs/common';

import {
  DefaultEnrollmentApplicationService,
  type EnrollmentRepository,
} from '@gurusthalam/learning';

import type {
  CourseRepository,
  CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  CoursesPersistenceModule,
} from '../database/prisma/repositories/index.js';

import {
  ENROLLMENT_REPOSITORY,
  LearningPersistenceModule,
} from '../database/prisma/repositories/learning/index.js';

@Module({
  imports: [CoursesPersistenceModule, LearningPersistenceModule],

  providers: [
    {
      provide: DefaultEnrollmentApplicationService,

      inject: [
        ENROLLMENT_REPOSITORY,
        COURSE_REPOSITORY,
        COURSE_VERSION_REPOSITORY,
      ],

      useFactory: (
        enrollmentRepository: EnrollmentRepository,
        courseRepository: CourseRepository,
        courseVersionRepository: CourseVersionRepository,
      ): DefaultEnrollmentApplicationService =>
        new DefaultEnrollmentApplicationService(
          enrollmentRepository,
          courseRepository,
          courseVersionRepository,
        ),
    },
  ],

  exports: [DefaultEnrollmentApplicationService],
})
export class LearningApplicationModule {}
