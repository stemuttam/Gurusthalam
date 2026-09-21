import { Module } from '@nestjs/common';

import type { CourseQuery } from '@gurusthalam/courses';

import { DatabaseModule } from '../../../database.module.js';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseQuery } from './prisma-course.query.js';

import { PrismaCourseRepository } from './prisma-course.repository.js';

import { PrismaCourseVersionAuditRepository } from './prisma-course-version-audit.repository.js';

import { PrismaCourseVersionLineageRepository } from './prisma-course-version-lineage.repository.js';

import { PrismaCourseVersionRepository } from './prisma-course-version.repository.js';

import {
  COURSE_QUERY,
  COURSE_REPOSITORY,
  COURSE_VERSION_AUDIT_REPOSITORY,
  COURSE_VERSION_LINEAGE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
} from './courses-repository.tokens.js';

@Module({
  imports: [DatabaseModule],

  providers: [
    {
      provide: COURSE_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaCourseRepository =>
        new PrismaCourseRepository(prisma),
    },

    {
      provide: COURSE_QUERY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): CourseQuery =>
        new PrismaCourseQuery(prisma),
    },

    {
      provide: COURSE_VERSION_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaCourseVersionRepository =>
        new PrismaCourseVersionRepository(prisma),
    },

    {
      provide: COURSE_VERSION_AUDIT_REPOSITORY,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): PrismaCourseVersionAuditRepository =>
        new PrismaCourseVersionAuditRepository(prisma),
    },

    {
      provide: COURSE_VERSION_LINEAGE_REPOSITORY,

      inject: [PrismaService],

      useFactory: (
        prisma: PrismaService,
      ): PrismaCourseVersionLineageRepository =>
        new PrismaCourseVersionLineageRepository(prisma),
    },
  ],

  exports: [
    COURSE_REPOSITORY,
    COURSE_QUERY,
    COURSE_VERSION_REPOSITORY,
    COURSE_VERSION_AUDIT_REPOSITORY,
    COURSE_VERSION_LINEAGE_REPOSITORY,
  ],
})
export class CoursesPersistenceModule {}
