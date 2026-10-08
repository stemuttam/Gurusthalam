import { describe, expect, it } from 'vitest';

import { Test } from '@nestjs/testing';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  DefaultLessonProgressApplicationService,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { LearningApplicationModule } from './learning-application.module.js';

describe('LearningApplicationModule', () => {
  const createTestingModule = async () =>
    Test.createTestingModule({
      imports: [LearningApplicationModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves the Enrollment application service', async () => {
    const moduleRef = await createTestingModule();

    try {
      const service = moduleRef.get<DefaultEnrollmentApplicationService>(
        DefaultEnrollmentApplicationService,
      );

      expect(service).toBeInstanceOf(DefaultEnrollmentApplicationService);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the Entitlement application service', async () => {
    const moduleRef = await createTestingModule();

    try {
      const service = moduleRef.get<DefaultEntitlementApplicationService>(
        DefaultEntitlementApplicationService,
      );

      expect(service).toBeInstanceOf(DefaultEntitlementApplicationService);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the LessonProgress application service', async () => {
    const moduleRef = await createTestingModule();

    try {
      const service = moduleRef.get<DefaultLessonProgressApplicationService>(
        DefaultLessonProgressApplicationService,
      );

      expect(service).toBeInstanceOf(DefaultLessonProgressApplicationService);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves independent Enrollment, Entitlement, and LessonProgress application boundaries', async () => {
    const moduleRef = await createTestingModule();

    try {
      const enrollmentService =
        moduleRef.get<DefaultEnrollmentApplicationService>(
          DefaultEnrollmentApplicationService,
        );

      const entitlementService =
        moduleRef.get<DefaultEntitlementApplicationService>(
          DefaultEntitlementApplicationService,
        );

      const lessonProgressService =
        moduleRef.get<DefaultLessonProgressApplicationService>(
          DefaultLessonProgressApplicationService,
        );

      expect(enrollmentService).toBeInstanceOf(
        DefaultEnrollmentApplicationService,
      );

      expect(entitlementService).toBeInstanceOf(
        DefaultEntitlementApplicationService,
      );

      expect(lessonProgressService).toBeInstanceOf(
        DefaultLessonProgressApplicationService,
      );

      expect(enrollmentService).not.toBe(entitlementService);
      expect(enrollmentService).not.toBe(lessonProgressService);
      expect(entitlementService).not.toBe(lessonProgressService);
    } finally {
      await moduleRef.close();
    }
  });
});
