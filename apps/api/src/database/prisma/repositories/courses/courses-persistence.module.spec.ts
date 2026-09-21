import { describe, expect, it } from 'vitest';

import { Test } from '@nestjs/testing';

import type {
  CourseQuery,
  CourseRepository,
  CourseVersionAuditRepository,
  CourseVersionLineageRepository,
  CourseVersionRepository,
} from '@gurusthalam/courses';

import { PrismaService } from '../../prisma.service.js';

import {
  CoursesPersistenceModule,
  COURSE_QUERY,
  COURSE_REPOSITORY,
  COURSE_VERSION_AUDIT_REPOSITORY,
  COURSE_VERSION_LINEAGE_REPOSITORY,
  COURSE_VERSION_REPOSITORY,
  PrismaCourseQuery,
  PrismaCourseRepository,
  PrismaCourseVersionAuditRepository,
  PrismaCourseVersionLineageRepository,
  PrismaCourseVersionRepository,
} from './index.js';

describe('CoursesPersistenceModule', () => {
  const createTestingModule = async () =>
    Test.createTestingModule({
      imports: [CoursesPersistenceModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves the CourseRepository provider', async () => {
    const moduleRef = await createTestingModule();

    try {
      const repository = moduleRef.get<CourseRepository>(COURSE_REPOSITORY);

      expect(repository).toBeInstanceOf(PrismaCourseRepository);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the CourseQuery provider', async () => {
    const moduleRef = await createTestingModule();

    try {
      const query = moduleRef.get<CourseQuery>(COURSE_QUERY);

      expect(query).toBeInstanceOf(PrismaCourseQuery);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the CourseVersionRepository provider', async () => {
    const moduleRef = await createTestingModule();

    try {
      const repository = moduleRef.get<CourseVersionRepository>(
        COURSE_VERSION_REPOSITORY,
      );

      expect(repository).toBeInstanceOf(PrismaCourseVersionRepository);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the CourseVersionAuditRepository provider', async () => {
    const moduleRef = await createTestingModule();

    try {
      const repository = moduleRef.get<CourseVersionAuditRepository>(
        COURSE_VERSION_AUDIT_REPOSITORY,
      );

      expect(repository).toBeInstanceOf(PrismaCourseVersionAuditRepository);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the CourseVersionLineageRepository provider', async () => {
    const moduleRef = await createTestingModule();

    try {
      const repository = moduleRef.get<CourseVersionLineageRepository>(
        COURSE_VERSION_LINEAGE_REPOSITORY,
      );

      expect(repository).toBeInstanceOf(PrismaCourseVersionLineageRepository);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves all persistence providers independently', async () => {
    const moduleRef = await createTestingModule();

    try {
      const courseRepository =
        moduleRef.get<CourseRepository>(COURSE_REPOSITORY);

      const courseQuery = moduleRef.get<CourseQuery>(COURSE_QUERY);

      const versionRepository = moduleRef.get<CourseVersionRepository>(
        COURSE_VERSION_REPOSITORY,
      );

      const auditRepository = moduleRef.get<CourseVersionAuditRepository>(
        COURSE_VERSION_AUDIT_REPOSITORY,
      );

      const lineageRepository = moduleRef.get<CourseVersionLineageRepository>(
        COURSE_VERSION_LINEAGE_REPOSITORY,
      );

      expect(courseRepository).toBeInstanceOf(PrismaCourseRepository);

      expect(courseQuery).toBeInstanceOf(PrismaCourseQuery);

      expect(versionRepository).toBeInstanceOf(PrismaCourseVersionRepository);

      expect(auditRepository).toBeInstanceOf(
        PrismaCourseVersionAuditRepository,
      );

      expect(lineageRepository).toBeInstanceOf(
        PrismaCourseVersionLineageRepository,
      );

      expect(courseRepository).not.toBe(courseQuery);

      expect(courseRepository).not.toBe(versionRepository);

      expect(courseRepository).not.toBe(auditRepository);

      expect(courseRepository).not.toBe(lineageRepository);

      expect(courseQuery).not.toBe(versionRepository);

      expect(courseQuery).not.toBe(auditRepository);

      expect(courseQuery).not.toBe(lineageRepository);

      expect(versionRepository).not.toBe(auditRepository);

      expect(versionRepository).not.toBe(lineageRepository);

      expect(auditRepository).not.toBe(lineageRepository);
    } finally {
      await moduleRef.close();
    }
  });
});
