import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  Entitlement,
  EntitlementSource,
  EntitlementStatus,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaEntitlementRepository } from './prisma-entitlement.repository.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const TEST_NAMESPACE = `phase-5-2-g-entitlement-${process.pid}-${randomUUID()}`;

const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const prisma = new PrismaService();

const repository = new PrismaEntitlementRepository(prisma);

interface EnrollmentFixture {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly learnerId: string;
}

const createdEnrollmentIds = new Set<string>();

const createdEntitlementIds = new Set<string>();

const createdCourseIds = new Set<string>();

function learnerId(suffix: string): string {
  return `${TEST_LEARNER_PREFIX}${suffix}`;
}

/**
 * Creates the minimum real transactional Course graph required by
 * PostgreSQL's Enrollment foreign keys.
 *
 * Entitlement itself references Enrollment, while Enrollment references
 * Course and CourseVersion. Therefore integration tests must create the
 * complete authoritative relational chain rather than mocking Enrollment.
 */
async function createEnrollmentFixture(
  suffix: string,
): Promise<EnrollmentFixture> {
  const courseId = randomUUID();

  const courseVersionId = randomUUID();

  const enrollmentId = randomUUID();

  const currentLearnerId = learnerId(suffix);

  createdCourseIds.add(courseId);

  createdEnrollmentIds.add(enrollmentId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.2-G Entitlement Course ${courseId}`,
      description: 'Production PostgreSQL entitlement integration fixture.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      instructorId: TEST_INSTRUCTOR_ID,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: courseVersionId,
      courseId,
      version: 1,
      status: 'PUBLISHED',
      title: `Phase 5.2-G Entitlement Course Version ${courseId}`,
      description:
        'Published CourseVersion for Entitlement PostgreSQL integration tests.',
      publishedAt: new Date(),
    },
  });

  await prisma.enrollment.create({
    data: {
      id: enrollmentId,
      learnerId: currentLearnerId,
      courseId,
      courseVersionId,
      status: 'ACTIVE',
      source: 'DIRECT',
      startsAt: new Date(),
      expiresAt: null,
      completedAt: null,
      cancelledAt: null,
    },
  });

  return {
    enrollmentId,
    courseId,
    courseVersionId,
    learnerId: currentLearnerId,
  };
}

function createEntitlement(
  enrollmentId: string,
  options: {
    readonly startsAt?: Date;
    readonly expiresAt?: Date | null;
  } = {},
): Entitlement {
  const now = options.startsAt ?? new Date();

  return Entitlement.create({
    enrollmentId,
    source: EntitlementSource.DIRECT,
    startsAt: now,
    expiresAt: options.expiresAt === undefined ? null : options.expiresAt,
    now,
  });
}

async function cleanupTestData(): Promise<void> {
  /*
   * Entitlement owns no child records, but Enrollment owns the FK target.
   *
   * Therefore Entitlement must always be deleted before Enrollment.
   */
  if (createdEntitlementIds.size > 0) {
    await prisma.entitlement.deleteMany({
      where: {
        id: {
          in: Array.from(createdEntitlementIds),
        },
      },
    });
  }

  /*
   * Defensive namespace cleanup in case a test failed before recording
   * the generated Entitlement identity.
   */
  const enrollmentIds = Array.from(createdEnrollmentIds);

  if (enrollmentIds.length > 0) {
    await prisma.entitlement.deleteMany({
      where: {
        enrollmentId: {
          in: enrollmentIds,
        },
      },
    });
  }

  /*
   * Enrollment must be deleted before CourseVersion because the
   * Enrollment -> CourseVersion relation uses ON DELETE RESTRICT.
   */
  if (createdEnrollmentIds.size > 0) {
    await prisma.enrollment.deleteMany({
      where: {
        id: {
          in: Array.from(createdEnrollmentIds),
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

  createdEntitlementIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('PrismaEntitlementRepository - PostgreSQL integration - Phase 5.2-G', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('PostgreSQL create and read round-trip', () => {
    it('persists and rehydrates an ACTIVE Entitlement from PostgreSQL', async () => {
      const fixture = await createEnrollmentFixture('round-trip');

      const startsAt = new Date('2026-10-06T10:00:00.000Z');

      const expiresAt = new Date('2026-12-06T10:00:00.000Z');

      const entitlement = createEntitlement(fixture.enrollmentId, {
        startsAt,
        expiresAt,
      });

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const persisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted?.id).toBe(entitlement.id);

      expect(persisted?.enrollmentId).toBe(fixture.enrollmentId);

      expect(persisted?.status).toBe('ACTIVE');

      expect(persisted?.source).toBe('DIRECT');

      expect(persisted?.startsAt).toEqual(startsAt);

      expect(persisted?.expiresAt).toEqual(expiresAt);

      expect(persisted?.revokedAt).toBeNull();

      const rehydrated = await repository.findById(entitlement.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.id).toBe(entitlement.id);

      expect(rehydrated?.enrollmentId).toBe(fixture.enrollmentId);

      expect(rehydrated?.status).toBe(EntitlementStatus.ACTIVE);

      expect(rehydrated?.source).toBe(EntitlementSource.DIRECT);

      expect(rehydrated?.startsAt).toEqual(startsAt);

      expect(rehydrated?.expiresAt).toEqual(expiresAt);

      expect(rehydrated?.revokedAt).toBeNull();

      expect(rehydrated?.createdAt).toEqual(entitlement.createdAt);

      expect(rehydrated?.updatedAt).toEqual(entitlement.updatedAt);
    });
  });

  describe('Active/suspended lookup contract', () => {
    it('finds an ACTIVE Entitlement by Enrollment', async () => {
      const fixture = await createEnrollmentFixture('active-lookup');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const found = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(found).not.toBeNull();

      expect(found?.id).toBe(entitlement.id);

      expect(found?.status).toBe(EntitlementStatus.ACTIVE);

      expect(found?.enrollmentId).toBe(fixture.enrollmentId);
    });

    it('finds a SUSPENDED Entitlement by Enrollment', async () => {
      const fixture = await createEnrollmentFixture('suspended-lookup');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const suspendedAt = new Date('2026-10-06T11:00:00.000Z');

      entitlement.suspend(suspendedAt);

      await repository.save(entitlement);

      const found = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(found).not.toBeNull();

      expect(found?.id).toBe(entitlement.id);

      expect(found?.status).toBe(EntitlementStatus.SUSPENDED);
    });

    it('does not return a REVOKED Entitlement from the active lookup', async () => {
      const fixture = await createEnrollmentFixture('revoked-exclusion');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const revokedAt = new Date('2026-10-06T12:00:00.000Z');

      entitlement.revoke(revokedAt);

      await repository.save(entitlement);

      const found = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(found).toBeNull();

      const persisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persisted?.status).toBe('REVOKED');

      expect(persisted?.revokedAt).toEqual(revokedAt);
    });

    it('does not return an EXPIRED Entitlement from the active lookup', async () => {
      const fixture = await createEnrollmentFixture('expired-exclusion');

      const startsAt = new Date('2026-10-06T13:00:00.000Z');

      const entitlement = createEntitlement(fixture.enrollmentId, {
        startsAt,
      });

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const expiredAt = new Date('2026-10-06T14:00:00.000Z');

      entitlement.expire(expiredAt);

      await repository.save(entitlement);

      const found = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(found).toBeNull();

      const persisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persisted?.status).toBe('EXPIRED');
    });
  });

  describe('Lifecycle persistence and rehydration', () => {
    it('persists a lifecycle transition and rehydrates the new state', async () => {
      const fixture = await createEnrollmentFixture('lifecycle');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const suspendedAt = new Date('2026-10-06T15:00:00.000Z');

      entitlement.suspend(suspendedAt);

      await repository.save(entitlement);

      const rehydrated = await repository.findById(entitlement.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.status).toBe(EntitlementStatus.SUSPENDED);

      expect(rehydrated?.revokedAt).toBeNull();

      expect(rehydrated?.updatedAt).toEqual(suspendedAt);

      /*
       * Repository rehydration must never manufacture a new domain event.
       */
      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });

    it('round-trips revokedAt through PostgreSQL', async () => {
      const fixture = await createEnrollmentFixture('revoked-timestamp');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const revokedAt = new Date('2026-10-06T16:00:00.000Z');

      entitlement.revoke(revokedAt);

      await repository.save(entitlement);

      const rehydrated = await repository.findById(entitlement.id);

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.status).toBe(EntitlementStatus.REVOKED);

      expect(rehydrated?.revokedAt).toEqual(revokedAt);

      const persisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persisted?.revokedAt).toEqual(revokedAt);
    });
  });

  describe('Domain-event ownership boundary', () => {
    it('does not drain pending domain events when persistence succeeds', async () => {
      const fixture = await createEnrollmentFixture('event-retention');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      expect(entitlement.getDomainEvents()).toHaveLength(1);

      await repository.save(entitlement);

      /*
       * 5.2-G repository responsibility ends at persistence.
       *
       * Transactional Outbox ownership belongs to 5.2-H.
       */
      expect(entitlement.getDomainEvents()).toHaveLength(1);
    });
  });

  describe('PostgreSQL foreign-key enforcement', () => {
    it('maps a missing Enrollment foreign key to P2003 repository error', async () => {
      const entitlement = createEntitlement(randomUUID());

      createdEntitlementIds.add(entitlement.id);

      await expect(repository.save(entitlement)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2003');

          expect(repositoryError.cause).toBeDefined();

          return true;
        },
      );

      const persisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persisted).toBeNull();
    });
  });

  describe('PostgreSQL partial unique-index enforcement', () => {
    it('allows exactly one ACTIVE Entitlement for an Enrollment under concurrency', async () => {
      const fixture = await createEnrollmentFixture('concurrent-active');

      const first = createEntitlement(fixture.enrollmentId);

      const second = createEntitlement(fixture.enrollmentId);

      expect(first.id).not.toBe(second.id);

      createdEntitlementIds.add(first.id);

      createdEntitlementIds.add(second.id);

      const results = await Promise.allSettled([
        repository.save(first),
        repository.save(second),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);

      expect(rejected).toHaveLength(1);

      const rejectedReason = rejected[0]?.reason;

      expect(rejectedReason).toBeInstanceOf(PrismaRepositoryError);

      const repositoryError = rejectedReason as PrismaRepositoryError;

      expect(repositoryError.code).toBe(
        PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      );

      expect(repositoryError.prismaCode).toBe('P2002');

      const persistedCount = await prisma.entitlement.count({
        where: {
          enrollmentId: fixture.enrollmentId,
          status: {
            in: ['ACTIVE', 'SUSPENDED'],
          },
        },
      });

      expect(persistedCount).toBe(1);

      const persisted = await prisma.entitlement.findMany({
        where: {
          enrollmentId: fixture.enrollmentId,
          status: {
            in: ['ACTIVE', 'SUSPENDED'],
          },
        },
      });

      expect(persisted).toHaveLength(1);
    });

    it('allows a new ACTIVE Entitlement after the previous Entitlement becomes REVOKED', async () => {
      const fixture = await createEnrollmentFixture('after-revocation');

      const original = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(original.id);

      await repository.save(original);

      const revokedAt = new Date('2026-10-06T17:00:00.000Z');

      original.revoke(revokedAt);

      await repository.save(original);

      const replacement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(replacement.id);

      await repository.save(replacement);

      const activeCount = await prisma.entitlement.count({
        where: {
          enrollmentId: fixture.enrollmentId,
          status: {
            in: ['ACTIVE', 'SUSPENDED'],
          },
        },
      });

      expect(activeCount).toBe(1);

      const historical = await prisma.entitlement.findUnique({
        where: {
          id: original.id,
        },
      });

      expect(historical?.status).toBe('REVOKED');

      const current = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(current?.id).toBe(replacement.id);

      expect(current?.status).toBe(EntitlementStatus.ACTIVE);
    });

    it('allows a new ACTIVE Entitlement after the previous Entitlement becomes EXPIRED', async () => {
      const fixture = await createEnrollmentFixture('after-expiration');

      const original = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(original.id);

      await repository.save(original);

      const expiredAt = new Date('2026-10-06T18:00:00.000Z');

      original.expire(expiredAt);

      await repository.save(original);

      const replacement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(replacement.id);

      await repository.save(replacement);

      const activeCount = await prisma.entitlement.count({
        where: {
          enrollmentId: fixture.enrollmentId,
          status: {
            in: ['ACTIVE', 'SUSPENDED'],
          },
        },
      });

      expect(activeCount).toBe(1);

      const historical = await prisma.entitlement.findUnique({
        where: {
          id: original.id,
        },
      });

      expect(historical?.status).toBe('EXPIRED');

      const current = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(current?.id).toBe(replacement.id);

      expect(current?.status).toBe(EntitlementStatus.ACTIVE);
    });

    it('keeps the ACTIVE/SUSPENDED uniqueness boundary after suspension', async () => {
      const fixture = await createEnrollmentFixture('suspended-unique');

      const first = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(first.id);

      await repository.save(first);

      first.suspend(new Date('2026-10-06T19:00:00.000Z'));

      await repository.save(first);

      const second = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(second.id);

      await expect(repository.save(second)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2002');

          return true;
        },
      );

      const persistedCount = await prisma.entitlement.count({
        where: {
          enrollmentId: fixture.enrollmentId,
          status: {
            in: ['ACTIVE', 'SUSPENDED'],
          },
        },
      });

      expect(persistedCount).toBe(1);

      const found = await repository.findActiveByEnrollmentId(
        fixture.enrollmentId,
      );

      expect(found?.id).toBe(first.id);

      expect(found?.status).toBe(EntitlementStatus.SUSPENDED);
    });
  });
});
