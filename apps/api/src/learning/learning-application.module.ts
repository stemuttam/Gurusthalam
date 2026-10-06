import { Module } from '@nestjs/common';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  type EnrollmentRepository,
  type EntitlementRepository,
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
  ENTITLEMENT_REPOSITORY,
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

    {
      provide: DefaultEntitlementApplicationService,

      inject: [ENTITLEMENT_REPOSITORY, ENROLLMENT_REPOSITORY],

      useFactory: (
        entitlementRepository: EntitlementRepository,
        enrollmentRepository: EnrollmentRepository,
      ): DefaultEntitlementApplicationService =>
        new DefaultEntitlementApplicationService(
          entitlementRepository,
          enrollmentRepository,
        ),
    },
  ],

  exports: [
    DefaultEnrollmentApplicationService,
    DefaultEntitlementApplicationService,
  ],
})
export class LearningApplicationModule {}
