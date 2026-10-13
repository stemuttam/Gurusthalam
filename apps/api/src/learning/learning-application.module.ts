import { Module } from '@nestjs/common';

import {
  DefaultCourseProgressApplicationService,
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  DefaultLessonProgressApplicationService,
  DefaultProgressApplicationService,
  DefaultSectionProgressApplicationService,
  DefaultLearningStreakApplicationService,
  type LearningHistoryQueryRepository,
  type CourseProgressReadModelRepository,
  type EnrollmentRepository,
  type EntitlementApplicationService,
  type EntitlementRepository,
  type LessonProgressBatchQueryRepository,
  type LessonProgressRepository,
  type ProgressRepository,
  type SectionProgressRepository,
} from '@gurusthalam/learning';

import type {
  CourseRepository,
  CourseStructureRepository,
  CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  CoursesPersistenceModule,
} from '../database/prisma/repositories/index.js';

import {
  COURSE_PROGRESS_READ_MODEL_REPOSITORY,
  ENROLLMENT_REPOSITORY,
  ENTITLEMENT_REPOSITORY,
  LESSON_PROGRESS_BATCH_QUERY_REPOSITORY,
  LESSON_PROGRESS_REPOSITORY,
  LearningPersistenceModule,
  PROGRESS_REPOSITORY,
  SECTION_PROGRESS_REPOSITORY,
  LEARNING_HISTORY_QUERY_REPOSITORY,
} from '../database/prisma/repositories/learning/index.js';

import { COURSE_STRUCTURE_REPOSITORY } from '../database/prisma/repositories/courses/courses-repository.tokens.js';

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

    {
      provide: DefaultLessonProgressApplicationService,
      inject: [
        LESSON_PROGRESS_REPOSITORY,
        DefaultEntitlementApplicationService,
      ],
      useFactory: (
        lessonProgressRepository: LessonProgressRepository,
        entitlementApplicationService: EntitlementApplicationService,
      ): DefaultLessonProgressApplicationService =>
        new DefaultLessonProgressApplicationService(
          lessonProgressRepository,
          entitlementApplicationService,
        ),
    },

    {
      provide: DefaultProgressApplicationService,
      inject: [PROGRESS_REPOSITORY, DefaultEntitlementApplicationService],
      useFactory: (
        progressRepository: ProgressRepository,
        entitlementApplicationService: EntitlementApplicationService,
      ): DefaultProgressApplicationService =>
        new DefaultProgressApplicationService(
          progressRepository,
          entitlementApplicationService,
        ),
    },

    {
      provide: DefaultSectionProgressApplicationService,
      inject: [
        SECTION_PROGRESS_REPOSITORY,
        DefaultEntitlementApplicationService,
      ],
      useFactory: (
        sectionProgressRepository: SectionProgressRepository,
        entitlementApplicationService: EntitlementApplicationService,
      ): DefaultSectionProgressApplicationService =>
        new DefaultSectionProgressApplicationService(
          sectionProgressRepository,
          entitlementApplicationService,
        ),
    },

    {
      provide: DefaultCourseProgressApplicationService,
      inject: [
        ENROLLMENT_REPOSITORY,
        COURSE_STRUCTURE_REPOSITORY,
        LESSON_PROGRESS_BATCH_QUERY_REPOSITORY,
        COURSE_PROGRESS_READ_MODEL_REPOSITORY,
      ],
      useFactory: (
        enrollmentRepository: EnrollmentRepository,
        courseStructureRepository: CourseStructureRepository,
        lessonProgressBatchQueryRepository: LessonProgressBatchQueryRepository,
        courseProgressReadModelRepository: CourseProgressReadModelRepository,
      ): DefaultCourseProgressApplicationService =>
        new DefaultCourseProgressApplicationService(
          enrollmentRepository,
          courseStructureRepository,
          lessonProgressBatchQueryRepository,
          courseProgressReadModelRepository,
        ),
    },

    {
      provide: DefaultLearningStreakApplicationService,
      inject: [LEARNING_HISTORY_QUERY_REPOSITORY],
      useFactory: (
        learningHistoryQueryRepository: LearningHistoryQueryRepository,
      ): DefaultLearningStreakApplicationService =>
        new DefaultLearningStreakApplicationService(
          learningHistoryQueryRepository,
        ),
    },
  ],

  exports: [
    DefaultEnrollmentApplicationService,
    DefaultEntitlementApplicationService,
    DefaultLessonProgressApplicationService,
    DefaultProgressApplicationService,
    DefaultSectionProgressApplicationService,
    DefaultCourseProgressApplicationService,
    DefaultLearningStreakApplicationService,
  ],
})
export class LearningApplicationModule {}
