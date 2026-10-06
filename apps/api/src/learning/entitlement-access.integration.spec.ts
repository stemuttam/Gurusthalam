import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DefaultEnrollmentApplicationService,
  DefaultEntitlementApplicationService,
  Entitlement,
  EntitlementDomainError,
  EntitlementDomainErrorCode,
  EntitlementSource,
  EnrollmentDomainError,
  EnrollmentDomainErrorCode,
  EnrollmentSource,
} from '@gurusthalam/learning';

import { PrismaService } from '../database/prisma/prisma.service.js';

import { PrismaCourseRepository } from '../database/prisma/repositories/courses/prisma-course.repository.js';
import { PrismaCourseVersionRepository } from '../database/prisma/repositories/courses/prisma-course-version.repository.js';
import { PrismaEntitlementRepository } from '../database/prisma/repositories/learning/prisma-entitlement.repository.js';
import { PrismaEnrollmentRepository } from '../database/prisma/repositories/learning/prisma-enrollment.repository.js';

const TEST_NAMESPACE = `phase-5-2-j-k-p-${process.pid}-${randomUUID()}`;
const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;
const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const prisma = new PrismaService();

const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
const entitlementRepository = new PrismaEntitlementRepository(prisma);
const courseRepository = new PrismaCourseRepository(prisma);
const courseVersionRepository = new PrismaCourseVersionRepository(prisma);

const enrollmentService = new DefaultEnrollmentApplicationService(
  enrollmentRepository,
  courseRepository,
  courseVersionRepository,
);

const entitlementService = new DefaultEntitlementApplicationService(
  entitlementRepository,
  enrollmentRepository,
);

interface CourseFixture {
  readonly courseId: string;
  readonly publishedVersionId: string;
  readonly draftVersionId: string;
}

const createdCourseIds = new Set<string>();
const createdEnrollmentIds = new Set<string>();
const createdEntitlementIds = new Set<string>();
const createdOutboxIds = new Set<string>();

function learnerId(suffix: string): string {
  return `${TEST_LEARNER_PREFIX}${suffix}`;
}

async function createCourseFixture(): Promise<CourseFixture> {
  const courseId = randomUUID();
  const publishedVersionId = randomUUID();
  const draftVersionId = randomUUID();

  createdCourseIds.add(courseId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.2 access integration course ${courseId}`,
      description: 'Production integration-test course.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: TEST_INSTRUCTOR_ID,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: publishedVersionId,
      courseId,
      version: 1,
      status: 'PUBLISHED',
      title: `Phase 5.2 published version ${courseId}`,
      description: 'Published CourseVersion for Entitlement integration tests.',
      publishedAt: new Date(),
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: draftVersionId,
      courseId,
      version: 2,
      status: 'DRAFT',
      title: `Phase 5.2 draft version ${courseId}`,
      description: 'Draft CourseVersion for boundary tests.',
      publishedAt: null,
    },
  });

  return {
    courseId,
    publishedVersionId,
    draftVersionId,
  };
}

async function cleanupTestData(): Promise<void> {
  const enrollmentIds = new Set(createdEnrollmentIds);

  const persistedEnrollments = await prisma.enrollment.findMany({
    where: {
      learnerId: {
        startsWith: TEST_LEARNER_PREFIX,
      },
    },
    select: {
      id: true,
    },
  });

  for (const enrollment of persistedEnrollments) {
    enrollmentIds.add(enrollment.id);
  }

  const entitlementIds = new Set(createdEntitlementIds);

  if (enrollmentIds.size > 0) {
    const persistedEntitlements = await prisma.entitlement.findMany({
      where: {
        enrollmentId: {
          in: Array.from(enrollmentIds),
        },
      },
      select: {
        id: true,
      },
    });

    for (const entitlement of persistedEntitlements) {
      entitlementIds.add(entitlement.id);
    }
  }

  if (entitlementIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Entitlement',
        aggregateId: {
          in: Array.from(entitlementIds),
        },
      },
    });

    await prisma.entitlement.deleteMany({
      where: {
        id: {
          in: Array.from(entitlementIds),
        },
      },
    });
  }

  if (enrollmentIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Enrollment',
        aggregateId: {
          in: Array.from(enrollmentIds),
        },
      },
    });

    await prisma.enrollment.deleteMany({
      where: {
        id: {
          in: Array.from(enrollmentIds),
        },
      },
    });
  }

  if (createdOutboxIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        id: {
          in: Array.from(createdOutboxIds),
        },
      },
    });
  }

  if (createdCourseIds.size > 0) {
    await prisma.courseVersion.deleteMany({
      where: {
        courseId: {
          in: Array.from(createdCourseIds),
        },
      },
    });

    await prisma.course.deleteMany({
      where: {
        id: {
          in: Array.from(createdCourseIds),
        },
      },
    });
  }

  createdCourseIds.clear();
  createdEnrollmentIds.clear();
  createdEntitlementIds.clear();
  createdOutboxIds.clear();
}

function expectEnrollmentError(
  error: unknown,
  code: EnrollmentDomainErrorCode,
): void {
  expect(error).toBeInstanceOf(EnrollmentDomainError);
  expect((error as EnrollmentDomainError).code).toBe(code);
}

function expectEntitlementError(
  error: unknown,
  code: EntitlementDomainErrorCode,
): void {
  expect(error).toBeInstanceOf(EntitlementDomainError);
  expect((error as EntitlementDomainError).code).toBe(code);
}

describe('Phase 5.2 Course/Enrollment/Entitlement consistency + access integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('5.2-J Course / CourseVersion / Enrollment consistency', () => {
    it('creates Entitlement only through an already valid Enrollment boundary', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('published-course'),
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      expect(entitlement.enrollmentId).toBe(enrollment.id);

      const persistedEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: enrollment.id,
        },
      });

      expect(persistedEnrollment).not.toBeNull();
      expect(persistedEnrollment?.courseId).toBe(fixture.courseId);
      expect(persistedEnrollment?.courseVersionId).toBe(
        fixture.publishedVersionId,
      );

      expect(entitlement.toPrimitives()).not.toHaveProperty('courseId');
      expect(entitlement.toPrimitives()).not.toHaveProperty('courseVersionId');
    });

    it('inherits the Enrollment lifecycle boundary and rejects terminal cancelled Enrollment', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('cancelled-enrollment'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      enrollment.cancel();
      await enrollmentRepository.save(enrollment);

      await expect(
        entitlementService.grantEntitlement({
          enrollmentId: enrollment.id,
          source: EntitlementSource.DIRECT,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        expectEntitlementError(
          error,
          EntitlementDomainErrorCode.ENROLLMENT_NOT_ELIGIBLE,
        );
        return true;
      });
    });

    it('inherits the Enrollment lifecycle boundary and rejects terminal expired Enrollment', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('expired-enrollment'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      enrollment.expire();
      await enrollmentRepository.save(enrollment);

      await expect(
        entitlementService.grantEntitlement({
          enrollmentId: enrollment.id,
          source: EntitlementSource.DIRECT,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        expectEntitlementError(
          error,
          EntitlementDomainErrorCode.ENROLLMENT_NOT_ELIGIBLE,
        );
        return true;
      });
    });

    it('cannot create a valid Enrollment against a draft CourseVersion, so Entitlement cannot bypass that boundary', async () => {
      const fixture = await createCourseFixture();

      await expect(
        enrollmentService.enrollLearner({
          learnerId: learnerId('draft-version'),
          courseId: fixture.courseId,
          courseVersionId: fixture.draftVersionId,
          source: EnrollmentSource.DIRECT,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        expectEnrollmentError(
          error,
          EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        );
        return true;
      });

      const persistedEnrollments = await prisma.enrollment.count({
        where: {
          learnerId: learnerId('draft-version'),
        },
      });

      expect(persistedEnrollments).toBe(0);
    });

    it('cannot create a valid Enrollment against an unpublished Course', async () => {
      const courseId = randomUUID();
      const versionId = randomUUID();

      createdCourseIds.add(courseId);

      await prisma.course.create({
        data: {
          id: courseId,
          title: `Phase 5.2 unpublished course ${courseId}`,
          description: 'Unpublished course boundary test.',
          level: 'BEGINNER',
          type: 'SELF_PACED',
          visibility: 'PUBLIC',
          status: 'DRAFT',
          instructorId: TEST_INSTRUCTOR_ID,
        },
      });

      await prisma.courseVersion.create({
        data: {
          id: versionId,
          courseId,
          version: 1,
          status: 'DRAFT',
          title: `Phase 5.2 unpublished version ${courseId}`,
          description: 'Draft version for unpublished course test.',
          publishedAt: null,
        },
      });

      await expect(
        enrollmentService.enrollLearner({
          learnerId: learnerId('unpublished-course'),
          courseId,
          source: EnrollmentSource.DIRECT,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        expectEnrollmentError(
          error,
          EnrollmentDomainErrorCode.COURSE_NOT_AVAILABLE,
        );
        return true;
      });

      const persistedEnrollments = await prisma.enrollment.count({
        where: {
          learnerId: learnerId('unpublished-course'),
        },
      });

      expect(persistedEnrollments).toBe(0);
    });
  });

  describe('5.2-P persisted access decision integration', () => {
    it('allows ACTIVE Enrollment + ACTIVE Entitlement inside the access window', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('active-allowed'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date(enrollment.startsAt.getTime() + 1_000).toISOString(),
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ALLOWED');
    });

    it('allows COMPLETED Enrollment + ACTIVE Entitlement according to the retained product policy', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('completed-allowed'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      enrollment.complete();
      await enrollmentRepository.save(enrollment);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date(enrollment.startsAt.getTime() + 1_000).toISOString(),
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ALLOWED');
    });

    it('denies PENDING Enrollment even when an ACTIVE Entitlement exists', async () => {
      const fixture = await createCourseFixture();

      const futureStart = new Date(Date.now() + 60 * 60 * 1000);

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('pending-denied'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
        startsAt: futureStart.toISOString(),
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date(futureStart.getTime() - 1_000).toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENROLLMENT_NOT_ACTIVE');
    });

    it('denies access before Entitlement startsAt', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('before-entitlement-start'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const startsAt = new Date(Date.now() + 60 * 60 * 1000);

      const entitlement = Entitlement.create({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
        startsAt,
        expiresAt: null,
        now: new Date(),
      });

      createdEntitlementIds.add(entitlement.id);

      await entitlementRepository.save(entitlement);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date(startsAt.getTime() - 1_000).toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ACCESS_NOT_STARTED');
    });

    it('denies access at and after Entitlement expiresAt', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('expired-window'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const entitlement = Entitlement.create({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
        startsAt: enrollment.startsAt,
        expiresAt,
        now: new Date(),
      });

      createdEntitlementIds.add(entitlement.id);

      await entitlementRepository.save(entitlement);

      const atExpiry = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: expiresAt.toISOString(),
      });

      expect(atExpiry.allowed).toBe(false);
      expect(atExpiry.reason).toBe('ACCESS_EXPIRED');

      const afterExpiry = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date(expiresAt.getTime() + 1_000).toISOString(),
      });

      expect(afterExpiry.allowed).toBe(false);
      expect(afterExpiry.reason).toBe('ACCESS_EXPIRED');
    });

    it('denies access while Entitlement is SUSPENDED', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('suspended-denied'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      await entitlementService.suspendEntitlement({
        entitlementId: entitlement.id,
      });

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENTITLEMENT_NOT_ACTIVE');
    });

    it('denies access after Entitlement is REVOKED', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('revoked-denied'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      await entitlementService.revokeEntitlement({
        entitlementId: entitlement.id,
      });

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENTITLEMENT_NOT_ACTIVE');
    });

    it('denies access after Enrollment is EXPIRED', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('enrollment-expired-denied'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      enrollment.expire();
      await enrollmentRepository.save(enrollment);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENROLLMENT_NOT_ACTIVE');
    });

    it('returns ENROLLMENT_NOT_ACTIVE when the Enrollment does not exist', async () => {
      const result = await entitlementService.checkAccess({
        enrollmentId: randomUUID(),
        now: new Date().toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENROLLMENT_NOT_ACTIVE');
    });

    it('returns ENTITLEMENT_NOT_ACTIVE when the Enrollment has no active/suspended Entitlement', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('no-entitlement'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const result = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENTITLEMENT_NOT_ACTIVE');
    });

    it('restores access after a suspended Entitlement is restored', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('restore-access'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const entitlement = await entitlementService.grantEntitlement({
        enrollmentId: enrollment.id,
        source: EntitlementSource.DIRECT,
      });

      createdEntitlementIds.add(entitlement.id);

      await entitlementService.suspendEntitlement({
        entitlementId: entitlement.id,
      });

      const denied = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(denied.allowed).toBe(false);
      expect(denied.reason).toBe('ENTITLEMENT_NOT_ACTIVE');

      await entitlementService.restoreEntitlement({
        entitlementId: entitlement.id,
      });

      const allowed = await entitlementService.checkAccess({
        enrollmentId: enrollment.id,
        now: new Date().toISOString(),
      });

      expect(allowed.allowed).toBe(true);
      expect(allowed.reason).toBe('ALLOWED');
    });
  });

  describe('5.2-P invalid application input boundary', () => {
    it('rejects an invalid Enrollment identifier before hitting persistence', async () => {
      await expect(
        entitlementService.checkAccess({
          enrollmentId: '',
        }),
      ).rejects.toThrow();
    });

    it('rejects an invalid ISO timestamp before hitting persistence', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('invalid-time'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      await expect(
        entitlementService.checkAccess({
          enrollmentId: enrollment.id,
          now: 'not-a-date',
        }),
      ).rejects.toThrow();
    });
  });
});
