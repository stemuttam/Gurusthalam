import { Module } from '@nestjs/common';

import {
  DefaultCourseApplicationService,
} from '@gurusthalam/courses';

import {
  CoursesPersistenceModule,
} from '../database/prisma/repositories/index.js';

import {
  COURSE_REPOSITORY,
} from '../database/prisma/repositories/courses/courses-repository.tokens.js';

@Module({
  imports: [
    CoursesPersistenceModule,
  ],

  providers: [
    {
      provide: DefaultCourseApplicationService,

      inject: [
        COURSE_REPOSITORY,
      ],

      useFactory: (
        courseRepository,
      ): DefaultCourseApplicationService =>
        new DefaultCourseApplicationService(
          courseRepository,
        ),
    },
  ],

  exports: [
    DefaultCourseApplicationService,
  ],
})
export class CoursesApplicationModule {}