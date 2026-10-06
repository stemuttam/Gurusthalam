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

const TEST_NAMESPACE = `phase-5-2-h-entitlement-${process.pid}-${randomUUID()}`;

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

const createdOutboxIds = new Set<string>();

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
      title: `Phase 5.2-H Entitlement Course ${courseId}`,
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
      title: `Phase 5.2-H Entitlement Course Version ${courseId}`,
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
   * Phase 5.2-H:
   *
   * Entitlement persistence now owns the transactional Outbox write.
   * Therefore OutboxEvent records must be removed before their aggregate
   * Entitlement records and before the referenced Enrollment records.
   */
  if (createdOutboxIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        id: {
          in: Array.from(createdOutboxIds),
        },
      },
    });
  }

  /*
   * Defensive namespace cleanup for Entitlement Outbox records.
   *
   * This handles records that were created successfully but whose IDs
   * could not be tracked because a test failed immediately afterwards.
   */
  if (createdEntitlementIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Entitlement',
        aggregateId: {
          in: Array.from(createdEntitlementIds),
        },
      },
    });
  }

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
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Entitlement',
        aggregateId: {
          in: createdEntitlementIds.size
            ? Array.from(createdEntitlementIds)
            : [],
        },
      },
    });

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

  createdOutboxIds.clear();
  createdEntitlementIds.clear();
  createdEnrollmentIds.clear();
  createdCourseIds.clear();
}

describe('PrismaEntitlementRepository - PostgreSQL integration - Phase 5.2-H', () => {
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

      expect(entitlement.getDomainEvents()).toHaveLength(0);
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

    it('persists each lifecycle event through the transactional Outbox', async () => {
      const fixture = await createEnrollmentFixture('all-lifecycle-events');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      const grantedEvent = entitlement.getDomainEvents()[0];

      if (grantedEvent === undefined) {
        throw new Error('Expected EntitlementGranted event.');
      }

      await repository.save(entitlement);

      const suspendedAt = new Date('2026-10-06T20:00:00.000Z');

      entitlement.suspend(suspendedAt);

      const suspendedEvent = entitlement.getDomainEvents()[0];

      if (suspendedEvent === undefined) {
        throw new Error('Expected EntitlementSuspended event.');
      }

      await repository.save(entitlement);

      const restoredAt = new Date('2026-10-06T21:00:00.000Z');

      entitlement.restore(restoredAt);

      const restoredEvent = entitlement.getDomainEvents()[0];

      if (restoredEvent === undefined) {
        throw new Error('Expected EntitlementRestored event.');
      }

      await repository.save(entitlement);

      const revokedAt = new Date('2026-10-06T22:00:00.000Z');

      entitlement.revoke(revokedAt);

      const revokedEvent = entitlement.getDomainEvents()[0];

      if (revokedEvent === undefined) {
        throw new Error('Expected EntitlementRevoked event.');
      }

      await repository.save(entitlement);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Entitlement',
          aggregateId: entitlement.id,
        },
      });

      for (const outboxEvent of outboxEvents) {
        createdOutboxIds.add(outboxEvent.id);
      }

      expect(outboxEvents).toHaveLength(4);

      const expectedEvents = [
        grantedEvent,
        suspendedEvent,
        restoredEvent,
        revokedEvent,
      ];

      for (const expectedEvent of expectedEvents) {
        const matchingOutboxEvent = outboxEvents.find(
          (outboxEvent) =>
            outboxEvent.dedupeKey ===
            `learning.entitlement:${expectedEvent.eventId}`,
        );

        expect(matchingOutboxEvent).toBeDefined();

        expect(matchingOutboxEvent?.eventType).toBe(expectedEvent.eventName);

        expect(matchingOutboxEvent?.aggregateType).toBe('Entitlement');

        expect(matchingOutboxEvent?.aggregateId).toBe(entitlement.id);
      }

      expect(entitlement.getDomainEvents()).toHaveLength(0);
    });

    it('persists an EXPIRED lifecycle event through the transactional Outbox', async () => {
      const fixture = await createEnrollmentFixture('expired-event');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const expiredAt = new Date('2026-10-06T23:00:00.000Z');

      entitlement.expire(expiredAt);

      const pendingEvents = entitlement.getDomainEvents();

      expect(pendingEvents).toHaveLength(1);

      const expiredEvent = pendingEvents[0];

      if (expiredEvent === undefined) {
        throw new Error('Expected EntitlementExpired event.');
      }

      await repository.save(entitlement);

      const persistedOutboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.entitlement:${expiredEvent.eventId}`,
        },
      });

      expect(persistedOutboxEvent).not.toBeNull();

      expect(persistedOutboxEvent?.eventType).toBe(
        'learning.entitlement.expired',
      );

      expect(persistedOutboxEvent?.aggregateId).toBe(entitlement.id);

      expect(entitlement.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Transactional Outbox and domain-event ownership', () => {
    it('persists the domain event to the Outbox and drains it after successful transaction commit', async () => {
      const fixture = await createEnrollmentFixture('event-transaction');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      const pendingEvents = entitlement.getDomainEvents();

      expect(pendingEvents).toHaveLength(1);

      const event = pendingEvents[0];

      if (event === undefined) {
        throw new Error(
          'Expected a pending Entitlement domain event before persistence.',
        );
      }

      expect(event.eventName).toBe('learning.entitlement.granted');

      expect(event.aggregateId).toBe(entitlement.id);

      expect(event.eventVersion).toBe(1);

      await repository.save(entitlement);

      /*
       * 5.2-H transactional ownership:
       *
       * Entitlement persistence and its Outbox record must commit
       * atomically. Only after the transaction succeeds may the
       * repository drain the aggregate's pending domain events.
       */
      expect(entitlement.getDomainEvents()).toHaveLength(0);

      const persistedEntitlement = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persistedEntitlement).not.toBeNull();

      const persistedOutboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.entitlement:${event.eventId}`,
        },
      });

      expect(persistedOutboxEvent).not.toBeNull();

      if (persistedOutboxEvent !== null) {
        createdOutboxIds.add(persistedOutboxEvent.id);
      }

      expect(persistedOutboxEvent?.eventType).toBe(event.eventName);

      expect(persistedOutboxEvent?.aggregateType).toBe('Entitlement');

      expect(persistedOutboxEvent?.aggregateId).toBe(entitlement.id);

      expect(persistedOutboxEvent?.status).toBe('PENDING');

      expect(persistedOutboxEvent?.attempts).toBe(0);

      /*
       * Compare the complete event envelope after JSON serialization.
       *
       * This verifies:
       *
       * - eventId
       * - eventName
       * - eventVersion
       * - aggregateId
       * - occurredAt
       * - complete business payload
       *
       * Date values are normalized to JSON ISO strings in exactly the
       * same way as the repository's Outbox serialization boundary.
       */
      const expectedOutboxPayload: unknown = JSON.parse(JSON.stringify(event));

      expect(persistedOutboxEvent?.payload).toEqual(expectedOutboxPayload);
    });

    it('persists multiple pending domain events from one aggregate transaction', async () => {
      const fixture = await createEnrollmentFixture('multiple-events');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      entitlement.suspend(new Date('2026-10-06T20:00:00.000Z'));

      entitlement.restore(new Date('2026-10-06T21:00:00.000Z'));

      entitlement.suspend(new Date('2026-10-06T22:00:00.000Z'));

      const pendingEvents = entitlement.getDomainEvents();

      expect(pendingEvents).toHaveLength(4);

      await repository.save(entitlement);

      expect(entitlement.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Entitlement',
          aggregateId: entitlement.id,
        },
      });

      for (const outboxEvent of outboxEvents) {
        createdOutboxIds.add(outboxEvent.id);
      }

      expect(outboxEvents).toHaveLength(4);

      for (const pendingEvent of pendingEvents) {
        const persistedEvent = outboxEvents.find(
          (outboxEvent) =>
            outboxEvent.dedupeKey ===
            `learning.entitlement:${pendingEvent.eventId}`,
        );

        expect(persistedEvent).toBeDefined();

        expect(persistedEvent?.eventType).toBe(pendingEvent.eventName);

        expect(persistedEvent?.aggregateId).toBe(pendingEvent.aggregateId);
      }
    });

    it('does not create Outbox events when saving a rehydrated unchanged Entitlement', async () => {
      const fixture = await createEnrollmentFixture('no-pending-events');

      const now = new Date('2026-10-06T09:00:00.000Z');

      const entitlement = Entitlement.rehydrate({
        id: randomUUID(),
        enrollmentId: fixture.enrollmentId,
        status: EntitlementStatus.ACTIVE,
        source: EntitlementSource.DIRECT,
        startsAt: now,
        expiresAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      createdEntitlementIds.add(entitlement.id);

      expect(entitlement.getDomainEvents()).toHaveLength(0);

      await repository.save(entitlement);

      expect(entitlement.getDomainEvents()).toHaveLength(0);

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Entitlement',
          aggregateId: entitlement.id,
        },
      });

      expect(outboxEvents).toHaveLength(0);
    });

    it('keeps the aggregate event pending when a real PostgreSQL Outbox constraint failure rolls back the transaction', async () => {
      const fixture = await createEnrollmentFixture('forced-outbox-failure');

      const entitlement = createEntitlement(fixture.enrollmentId);

      const pendingEvents = entitlement.getDomainEvents();

      expect(pendingEvents).toHaveLength(1);

      const event = pendingEvents[0];

      if (event === undefined) {
        throw new Error(
          'Expected a pending Entitlement domain event before forced failure.',
        );
      }

      const conflictingOutboxId = randomUUID();

      const dedupeKey = `learning.entitlement:${event.eventId}`;

      await prisma.outboxEvent.create({
        data: {
          id: conflictingOutboxId,
          eventType: 'learning.entitlement.conflict',
          aggregateType: 'Entitlement',
          aggregateId: entitlement.id,
          dedupeKey,
          payload: {
            conflict: true,
            testNamespace: TEST_NAMESPACE,
          },
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
        },
      });

      createdOutboxIds.add(conflictingOutboxId);

      await expect(repository.save(entitlement)).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(PrismaRepositoryError);

          const repositoryError = error as PrismaRepositoryError;

          expect(repositoryError.code).toBe(
            PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
          );

          expect(repositoryError.prismaCode).toBe('P2002');

          expect(repositoryError.cause).toBeDefined();

          return true;
        },
      );

      /*
       * The aggregate was intentionally NOT added to the cleanup set
       * before save(). The transaction failed, so the Entitlement row
       * must never have committed.
       */
      const persistedEntitlement = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(persistedEntitlement).toBeNull();

      /*
       * The conflicting Outbox row must remain because it was created
       * before the failing transaction and is therefore independent
       * committed state.
       */
      const conflictingOutbox = await prisma.outboxEvent.findUnique({
        where: {
          id: conflictingOutboxId,
        },
      });

      expect(conflictingOutbox).not.toBeNull();

      expect(conflictingOutbox?.dedupeKey).toBe(dedupeKey);

      /*
       * The failed transaction must NEVER consume the aggregate event.
       */
      expect(entitlement.getDomainEvents()).toHaveLength(1);

      expect(entitlement.getDomainEvents()[0]?.eventId).toBe(event.eventId);
    });

    it('rolls back a lifecycle persistence failure and preserves the previously committed state', async () => {
      const fixture = await createEnrollmentFixture('lifecycle-rollback');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      await repository.save(entitlement);

      const originalPersisted = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      expect(originalPersisted?.status).toBe('ACTIVE');

      const suspendedAt = new Date('2026-10-06T20:30:00.000Z');

      entitlement.suspend(suspendedAt);

      const pendingEvents = entitlement.getDomainEvents();

      expect(pendingEvents).toHaveLength(1);

      const lifecycleEvent = pendingEvents[0];

      if (lifecycleEvent === undefined) {
        throw new Error(
          'Expected EntitlementSuspended event before forced rollback.',
        );
      }

      const conflictingOutboxId = randomUUID();

      const dedupeKey = `learning.entitlement:${lifecycleEvent.eventId}`;

      await prisma.outboxEvent.create({
        data: {
          id: conflictingOutboxId,
          eventType: 'learning.entitlement.conflict',
          aggregateType: 'Entitlement',
          aggregateId: entitlement.id,
          dedupeKey,
          payload: {
            conflict: true,
            testNamespace: TEST_NAMESPACE,
          },
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
        },
      });

      createdOutboxIds.add(conflictingOutboxId);

      await expect(repository.save(entitlement)).rejects.toSatisfy(
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

      const persistedAfterFailure = await prisma.entitlement.findUnique({
        where: {
          id: entitlement.id,
        },
      });

      /*
       * The previous ACTIVE database state must survive the failed
       * SUSPENDED transaction.
       */
      expect(persistedAfterFailure?.status).toBe('ACTIVE');

      expect(persistedAfterFailure?.revokedAt).toBeNull();

      expect(persistedAfterFailure?.updatedAt).toEqual(
        originalPersisted?.updatedAt,
      );

      /*
       * The aggregate still contains the lifecycle event because the
       * failed transaction never reached pullDomainEvents().
       */
      expect(entitlement.getDomainEvents()).toHaveLength(1);

      expect(entitlement.getDomainEvents()[0]?.eventId).toBe(
        lifecycleEvent.eventId,
      );
    });

    it('uses the domain event identifier as the durable Outbox dedupe identity', async () => {
      const fixture = await createEnrollmentFixture('dedupe-identity');

      const entitlement = createEntitlement(fixture.enrollmentId);

      createdEntitlementIds.add(entitlement.id);

      const event = entitlement.getDomainEvents()[0];

      if (event === undefined) {
        throw new Error('Expected EntitlementGranted event.');
      }

      await repository.save(entitlement);

      const persistedOutboxEvent = await prisma.outboxEvent.findUnique({
        where: {
          dedupeKey: `learning.entitlement:${event.eventId}`,
        },
      });

      expect(persistedOutboxEvent).not.toBeNull();

      if (persistedOutboxEvent !== null) {
        createdOutboxIds.add(persistedOutboxEvent.id);
      }

      expect(persistedOutboxEvent?.dedupeKey).toBe(
        `learning.entitlement:${event.eventId}`,
      );

      expect(persistedOutboxEvent?.eventType).toBe(event.eventName);

      expect(persistedOutboxEvent?.aggregateId).toBe(entitlement.id);
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

      /*
       * The failed transaction must not drain the aggregate's pending
       * event because neither the Entitlement nor Outbox write committed.
       */
      expect(entitlement.getDomainEvents()).toHaveLength(1);
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

      /*
       * The successful transaction drains its event.
       */
      const successfulEntitlement =
        results[0]?.status === 'fulfilled' ? first : second;

      const rejectedEntitlement =
        successfulEntitlement === first ? second : first;

      expect(successfulEntitlement.getDomainEvents()).toHaveLength(0);

      /*
       * The losing transaction is rolled back by PostgreSQL's partial
       * unique index, so its event remains pending.
       */
      expect(rejectedEntitlement.getDomainEvents()).toHaveLength(1);

      const successfulEvent = successfulEntitlement.getDomainEvents()[0];

      expect(successfulEvent).toBeUndefined();

      const rejectedEvent = rejectedEntitlement.getDomainEvents()[0];

      expect(rejectedEvent).toBeDefined();

      if (rejectedEvent !== undefined) {
        const rejectedOutbox = await prisma.outboxEvent.findUnique({
          where: {
            dedupeKey: `learning.entitlement:${rejectedEvent.eventId}`,
          },
        });

        /*
         * No Outbox record may exist for the transaction that lost the
         * database uniqueness race.
         */
        expect(rejectedOutbox).toBeNull();
      }
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

      expect(second.getDomainEvents()).toHaveLength(1);

      const rejectedEvent = second.getDomainEvents()[0];

      if (rejectedEvent !== undefined) {
        const rejectedOutbox = await prisma.outboxEvent.findUnique({
          where: {
            dedupeKey: `learning.entitlement:${rejectedEvent.eventId}`,
          },
        });

        expect(rejectedOutbox).toBeNull();
      }
    });
  });
});
