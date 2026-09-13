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
  CourseVersionAuditRepository,
  CourseVersionRepository,
} from '@gurusthalam/courses';

import {
  PrismaService,
} from '../../prisma.service.js';

import {
  CoursesPersistenceModule,
  COURSE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  COURSE_VERSION_AUDIT_REPOSITORY,
  PrismaCourseRepository,
  PrismaCourseVersionRepository,
  PrismaCourseVersionAuditRepository,
} from './index.js';

describe(
  'CoursesPersistenceModule',
  () => {
    const createTestingModule =
      async () =>
        Test
          .createTestingModule({
            imports: [
              CoursesPersistenceModule,
            ],
          })
          .overrideProvider(
            PrismaService,
          )
          .useValue({})
          .compile();

    it(
      'resolves the CourseRepository provider',
      async () => {
        const moduleRef =
          await createTestingModule();

        try {
          const repository =
            moduleRef.get<CourseRepository>(
              COURSE_REPOSITORY,
            );

          expect(
            repository,
          ).toBeInstanceOf(
            PrismaCourseRepository,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'resolves the CourseVersionRepository provider',
      async () => {
        const moduleRef =
          await createTestingModule();

        try {
          const repository =
            moduleRef.get<CourseVersionRepository>(
              COURSE_VERSION_REPOSITORY,
            );

          expect(
            repository,
          ).toBeInstanceOf(
            PrismaCourseVersionRepository,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'resolves the CourseVersionAuditRepository provider',
      async () => {
        const moduleRef =
          await createTestingModule();

        try {
          const repository =
            moduleRef.get<CourseVersionAuditRepository>(
              COURSE_VERSION_AUDIT_REPOSITORY,
            );

          expect(
            repository,
          ).toBeInstanceOf(
            PrismaCourseVersionAuditRepository,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'resolves all repository providers independently',
      async () => {
        const moduleRef =
          await createTestingModule();

        try {
          const courseRepository =
            moduleRef.get<CourseRepository>(
              COURSE_REPOSITORY,
            );

          const versionRepository =
            moduleRef.get<CourseVersionRepository>(
              COURSE_VERSION_REPOSITORY,
            );

          const auditRepository =
            moduleRef.get<CourseVersionAuditRepository>(
              COURSE_VERSION_AUDIT_REPOSITORY,
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
            auditRepository,
          ).toBeInstanceOf(
            PrismaCourseVersionAuditRepository,
          );

          expect(
            courseRepository,
          ).not.toBe(
            versionRepository,
          );

          expect(
            courseRepository,
          ).not.toBe(
            auditRepository,
          );

          expect(
            versionRepository,
          ).not.toBe(
            auditRepository,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );
  },
);