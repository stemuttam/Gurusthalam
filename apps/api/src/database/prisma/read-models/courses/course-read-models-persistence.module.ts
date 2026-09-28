import { Module } from '@nestjs/common';

import type {
  CourseCatalogProjectionPersistence,
  CourseSearchProjectionPersistence,
} from '@gurusthalam/courses';

import { DatabaseModule } from '../../../database.module.js';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseCatalogProjectionPersistence } from './prisma-course-catalog-projection.persistence.js';

import { PrismaCourseSearchProjectionPersistence } from './prisma-course-search-projection.persistence.js';

import {
  COURSE_CATALOG_PROJECTION_PERSISTENCE,
  COURSE_SEARCH_PROJECTION_PERSISTENCE,
} from './course-projection.persistence.tokens.js';

/**
 * NestJS infrastructure module for Course read-model persistence.
 *
 * This module deliberately does not replace CoursesPersistenceModule.
 *
 * CoursesPersistenceModule owns:
 * - CourseRepository
 * - CourseQuery
 * - CourseVersion repositories
 *
 * This module owns:
 * - CourseCatalogProjectionPersistence
 * - CourseSearchProjectionPersistence
 */
@Module({
  imports: [DatabaseModule],

  providers: [
    {
      provide: COURSE_CATALOG_PROJECTION_PERSISTENCE,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): CourseCatalogProjectionPersistence =>
        new PrismaCourseCatalogProjectionPersistence(prisma),
    },

    {
      provide: COURSE_SEARCH_PROJECTION_PERSISTENCE,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService): CourseSearchProjectionPersistence =>
        new PrismaCourseSearchProjectionPersistence(prisma),
    },
  ],

  exports: [
    COURSE_CATALOG_PROJECTION_PERSISTENCE,
    COURSE_SEARCH_PROJECTION_PERSISTENCE,
  ],
})
export class CourseReadModelsPersistenceModule {}
