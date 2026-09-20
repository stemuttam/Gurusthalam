import { Module } from '@nestjs/common';

import {
  DefaultCourseApplicationService,
  DefaultCourseVersionApplicationService,
  type CourseRepository,
  type CourseVersionRepository,
} from '@gurusthalam/courses';

import { CoursesPersistenceModule } from '../database/prisma/repositories/index.js';

import {
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
} from '../database/prisma/repositories/courses/courses-repository.tokens.js';

@Module({
  imports: [CoursesPersistenceModule],

  providers: [
    {
      provide: DefaultCourseApplicationService,

      inject: [COURSE_REPOSITORY],

      useFactory: (
        courseRepository: CourseRepository,
      ): DefaultCourseApplicationService =>
        new DefaultCourseApplicationService(courseRepository),
    },

    {
      provide: DefaultCourseVersionApplicationService,

      inject: [COURSE_REPOSITORY, COURSE_VERSION_REPOSITORY],

      useFactory: (
        courseRepository: CourseRepository,
        courseVersionRepository: CourseVersionRepository,
      ): DefaultCourseVersionApplicationService =>
        new DefaultCourseVersionApplicationService(
          courseRepository,
          courseVersionRepository,
        ),
    },
  ],

  exports: [
    DefaultCourseApplicationService,
    DefaultCourseVersionApplicationService,
  ],
})
export class CoursesApplicationModule {}
