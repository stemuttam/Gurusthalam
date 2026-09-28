import { Module } from '@nestjs/common';

import {
DefaultCourseApplicationService,
DefaultCourseQueryApplicationService,
DefaultCourseVersionApplicationService,
type CourseQuery,
type CourseRepository,
type CourseVersionRepository,
} from '@gurusthalam/courses';

import { CoursesPersistenceModule } from '../database/prisma/repositories/index.js';

import {
COURSE_QUERY,
COURSE_REPOSITORY,
COURSE_VERSION_REPOSITORY,
} from '../database/prisma/repositories/courses/courses-repository.tokens.js';

import {
CourseController,
CourseVersionController,
} from './course.controller.js';

@Module({
imports: [CoursesPersistenceModule],

controllers: [
CourseController,
CourseVersionController,
],

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
  provide: DefaultCourseQueryApplicationService,

  inject: [COURSE_QUERY],

  useFactory: (
    courseQuery: CourseQuery,
  ): DefaultCourseQueryApplicationService =>
    new DefaultCourseQueryApplicationService(courseQuery),
},

{
  provide: DefaultCourseVersionApplicationService,

  inject: [
    COURSE_REPOSITORY,
    COURSE_VERSION_REPOSITORY,
  ],

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
DefaultCourseQueryApplicationService,
DefaultCourseVersionApplicationService,
],
})
export class CoursesApplicationModule {}