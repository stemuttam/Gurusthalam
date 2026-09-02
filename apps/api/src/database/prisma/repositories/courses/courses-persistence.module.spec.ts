import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  Test,
} from '@nestjs/testing';

import type {
  CourseRepository,
  CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  PrismaService,
} from '../../prisma.service.js';

import {
  CoursesPersistenceModule,
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  PrismaCourseRepository,
  PrismaCourseVersionRepository,
} from './index.js';

describe(
  'CoursesPersistenceModule',
  () => {
    const createTestingModule = async () =>
      Test
        .createTestingModule({
          imports: [
            CoursesPersistenceModule,
          ],

          providers: [
            {
              provide:
                PrismaService,

              useValue: {},
            },
          ],
        })
        .compile();

    it(
      'resolves the CourseRepository provider',
      async () => {
        const moduleRef =
          await createTestingModule();

        const repository =
          moduleRef.get<CourseRepository>(
            COURSE_REPOSITORY,
          );

        expect(
          repository,
        ).toBeInstanceOf(
          PrismaCourseRepository,
        );

        await moduleRef.close();
      },
    );

    it(
      'resolves the CourseVersionRepository provider',
      async () => {
        const moduleRef =
          await createTestingModule();

        const repository =
          moduleRef.get<CourseVersionRepository>(
            COURSE_VERSION_REPOSITORY,
          );

        expect(
          repository,
        ).toBeInstanceOf(
          PrismaCourseVersionRepository,
        );

        await moduleRef.close();
      },
    );

    it(
      'resolves both repository providers independently',
      async () => {
        const moduleRef =
          await createTestingModule();

        const courseRepository =
          moduleRef.get<CourseRepository>(
            COURSE_REPOSITORY,
          );

        const versionRepository =
          moduleRef.get<CourseVersionRepository>(
            COURSE_VERSION_REPOSITORY,
          );

        expect(
          courseRepository,
        ).toBeInstanceOf(
          PrismaCourseRepository,
        );

        expect(
          versionRepository,
        ).toBeInstanceOf(
          PrismaCourseVersionRepository,
        );

        expect(
          courseRepository,
        ).not.toBe(
          versionRepository,
        );

        await moduleRef.close();
      },
    );
  },
);