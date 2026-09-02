import {
  Module,
} from '@nestjs/common';

import {
  DatabaseModule,
} from '../../../database.module.js';

import {
  PrismaService,
} from '../../prisma.service.js';

import {
  PrismaCourseRepository,
} from './prisma-course.repository.js';

import {
  PrismaCourseVersionRepository,
} from './prisma-course-version.repository.js';

import {
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
} from './courses-repository.tokens.js';

@Module({
  imports: [
    DatabaseModule,
  ],

  providers: [
    {
      provide:
        COURSE_REPOSITORY,

      inject: [
        PrismaService,
      ],

      useFactory: (
        prisma: PrismaService,
      ): PrismaCourseRepository =>
        new PrismaCourseRepository(
          prisma,
        ),
    },

    {
      provide:
        COURSE_VERSION_REPOSITORY,

      inject: [
        PrismaService,
      ],

      useFactory: (
        prisma: PrismaService,
      ): PrismaCourseVersionRepository =>
        new PrismaCourseVersionRepository(
          prisma,
        ),
    },
  ],

  exports: [
    COURSE_REPOSITORY,
    COURSE_VERSION_REPOSITORY,
  ],
})
export class CoursesPersistenceModule {}