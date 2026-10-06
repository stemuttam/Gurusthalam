import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DefaultEnrollmentApplicationService,
  Enrollment,
  EnrollmentDomainError,
  EnrollmentDomainErrorCode,
  EnrollmentDomainEventName,
  EnrollmentSource,
  EnrollmentStatus,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseRepository } from '../courses/prisma-course.repository.js';

import { PrismaCourseVersionRepository } from '../courses/prisma-course-version.repository.js';

import { PrismaEnrollmentRepository } from './prisma-enrollment.repository.js';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../prisma-repository.error.js';

const TEST_NAMESPACE = `phase-5-1-enrollment-${process.pid}-${randomUUID()}`;

const TEST_INSTRUCTOR_ID = `${TEST_NAMESPACE}-instructor`;

const TEST_LEARNER_PREFIX = `${TEST_NAMESPACE}-learner-`;

const prisma = new PrismaService();

const enrollmentRepository = new PrismaEnrollmentRepository(prisma);

const courseRepository = new PrismaCourseRepository(prisma);

const courseVersionRepository = new PrismaCourseVersionRepository(prisma);

const enrollmentService = new DefaultEnrollmentApplicationService(
  enrollmentRepository,
  courseRepository,
  courseVersionRepository,
);

interface CourseFixture {
  readonly courseId: string;
  readonly publishedVersionId: string;
  readonly draftVersionId: string;
}

const createdCourseIds = new Set<string>();

const createdEnrollmentIds = new Set<string>();

const createdOutboxIds = new Set<string>();

function learnerId(suffix: string): string {
  return `${TEST_LEARNER_PREFIX}${suffix}`;
}

async function createCourseFixture(
  options: {
    readonly includeDraftVersion?: boolean;
    readonly publishedCourse?: boolean;
  } = {},
): Promise<CourseFixture> {
  const includeDraftVersion = options.includeDraftVersion ?? true;

  const publishedCourse = options.publishedCourse ?? true;

  const courseId = randomUUID();

  const publishedVersionId = randomUUID();

  const draftVersionId = randomUUID();

  createdCourseIds.add(courseId);

  await prisma.course.create({
    data: {
      id: courseId,
      title: `Phase 5.1 Integration Course ${courseId}`,
      description: 'Production integration-test course.',
      level: 'BEGINNER',
      type: 'SELF_PACED',
      visibility: 'PUBLIC',
      status: publishedCourse ? 'PUBLISHED' : 'DRAFT',
      instructorId: TEST_INSTRUCTOR_ID,
    },
  });

  await prisma.courseVersion.create({
    data: {
      id: publishedVersionId,
      courseId,
      version: 1,
      status: publishedCourse ? 'PUBLISHED' : 'DRAFT',
      title: `Phase 5.1 Published Version ${courseId}`,
      description: 'Published CourseVersion for Enrollment integration tests.',
      publishedAt: publishedCourse ? new Date() : null,
    },
  });

  let draftVersionIdToReturn = publishedVersionId;

  if (includeDraftVersion) {
    await prisma.courseVersion.create({
      data: {
        id: draftVersionId,
        courseId,
        version: 2,
        status: 'DRAFT',
        title: `Phase 5.1 Draft Version ${courseId}`,
        description: 'Draft CourseVersion for publication-policy tests.',
        publishedAt: null,
      },
    });

    draftVersionIdToReturn = draftVersionId;
  }

  return {
    courseId,
    publishedVersionId,
    draftVersionId: draftVersionIdToReturn,
  };
}

async function findEnrollmentIdsForTestLearners(): Promise<string[]> {
  const records = await prisma.enrollment.findMany({
    where: {
      learnerId: {
        startsWith: TEST_LEARNER_PREFIX,
      },
    },
    select: {
      id: true,
    },
  });

  return records.map((record) => record.id);
}

async function cleanupTestData(): Promise<void> {
  /*
   * Capture all Enrollment identities before deleting them so cleanup
   * remains deterministic even when a test failed before explicitly
   * recording an aggregate id.
   */
  const enrollmentIds = new Set<string>(createdEnrollmentIds);

  const persistedEnrollmentIds = await findEnrollmentIdsForTestLearners();

  for (const id of persistedEnrollmentIds) {
    enrollmentIds.add(id);
  }

  /*
   * OutboxEvent does not own the Enrollment FK relationship.
   * Delete Enrollment outbox rows before deleting Enrollment records.
   */
  if (enrollmentIds.size > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'Enrollment',
        aggregateId: {
          in: Array.from(enrollmentIds),
        },
      },
    });
  }

  /*
   * Preserve explicit cleanup coverage for any Outbox rows tracked
   * independently of aggregate-id discovery.
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

  await prisma.enrollment.deleteMany({
    where: {
      learnerId: {
        startsWith: TEST_LEARNER_PREFIX,
      },
    },
  });

  /*
   * CourseVersion has ON DELETE RESTRICT from Enrollment.
   * Enrollment must therefore be removed before CourseVersion.
   */
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

  createdEnrollmentIds.clear();
  createdOutboxIds.clear();
  createdCourseIds.clear();
}

function expectEnrollmentDomainError(
  error: unknown,
  code: EnrollmentDomainErrorCode,
): void {
  expect(error).toBeInstanceOf(EnrollmentDomainError);

  expect((error as EnrollmentDomainError).code).toBe(code);
}

describe('5.1 Enrollment PostgreSQL integration', () => {
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

  describe('Course identity contract', () => {
    it('accepts a valid CourseId and enrolls against the persisted Course', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('valid-course');

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      expect(enrollment.courseId).toBe(fixture.courseId);

      expect(enrollment.courseVersionId).toBe(fixture.publishedVersionId);

      expect(enrollment.status).toBe(EnrollmentStatus.ACTIVE);

      const persisted = await prisma.enrollment.findUnique({
        where: {
          id: enrollment.id,
        },
      });

      expect(persisted).not.toBeNull();

      expect(persisted?.courseId).toBe(fixture.courseId);

      expect(persisted?.courseVersionId).toBe(fixture.publishedVersionId);
    });

    it('rejects an invalid CourseId before creating an Enrollment', async () => {
      const invalidCourseId = '   ';

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('invalid-course-id'),
          courseId: invalidCourseId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error('Expected Enrollment to reject an invalid CourseId.');
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.VALIDATION,
        );
      }

      const count = await prisma.enrollment.count({
        where: {
          learnerId: learnerId('invalid-course-id'),
        },
      });

      expect(count).toBe(0);
    });

    it('rejects a Course that does not exist', async () => {
      const missingCourseId = randomUUID();

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('missing-course'),
          courseId: missingCourseId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error('Expected Enrollment to fail for a missing Course.');
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.COURSE_NOT_AVAILABLE,
        );
      }
    });

    it('rejects a Course that is not published', async () => {
      const fixture = await createCourseFixture({
        publishedCourse: false,
      });

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('unpublished-course'),
          courseId: fixture.courseId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error(
          'Expected Enrollment to fail for an unpublished Course.',
        );
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.COURSE_NOT_AVAILABLE,
        );
      }
    });
  });

  describe('CourseVersion ownership', () => {
    it('accepts a CourseVersion belonging to the selected Course', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('matching-version'),
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      expect(enrollment.courseVersionId).toBe(fixture.publishedVersionId);
    });

    it('rejects a CourseVersion belonging to another Course', async () => {
      const firstCourse = await createCourseFixture();

      const secondCourse = await createCourseFixture();

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('wrong-version-owner'),
          courseId: firstCourse.courseId,
          courseVersionId: secondCourse.publishedVersionId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error(
          'Expected Enrollment to reject a CourseVersion owned by another Course.',
        );
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        );
      }
    });

    it('rejects a nonexistent explicit CourseVersion', async () => {
      const fixture = await createCourseFixture();

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('missing-version'),
          courseId: fixture.courseId,
          courseVersionId: randomUUID(),
          source: EnrollmentSource.DIRECT,
        });

        throw new Error(
          'Expected Enrollment to reject a missing CourseVersion.',
        );
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        );
      }
    });
  });

  describe('Published-version policy', () => {
    it('automatically resolves the currently published CourseVersion', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('auto-published-version'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      expect(enrollment.courseVersionId).toBe(fixture.publishedVersionId);

      expect(enrollment.courseVersionId).not.toBe(fixture.draftVersionId);
    });

    it('accepts an explicitly requested published CourseVersion', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('explicit-published-version'),
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      expect(enrollment.courseVersionId).toBe(fixture.publishedVersionId);
    });

    it('rejects an explicitly requested draft CourseVersion', async () => {
      const fixture = await createCourseFixture();

      try {
        await enrollmentService.enrollLearner({
          learnerId: learnerId('draft-version'),
          courseId: fixture.courseId,
          courseVersionId: fixture.draftVersionId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error('Expected Enrollment to reject a draft CourseVersion.');
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.COURSE_VERSION_NOT_AVAILABLE,
        );
      }
    });
  });

  describe('Enrollment + Outbox atomicity', () => {
    it('persists Enrollment and EnrollmentCreated Outbox event atomically', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('atomic-success'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const persistedEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: enrollment.id,
        },
      });

      expect(persistedEnrollment).not.toBeNull();

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateType: 'Enrollment',
          aggregateId: enrollment.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      expect(outboxEvents).toHaveLength(1);

      const event = outboxEvents[0];

      expect(event).toBeDefined();

      if (event === undefined) {
        throw new Error('Expected Enrollment Outbox event to exist.');
      }

      expect(event.eventType).toBe(EnrollmentDomainEventName.CREATED);

      expect(event.aggregateType).toBe('Enrollment');

      expect(event.aggregateId).toBe(enrollment.id);

      expect(event.status).toBe('PENDING');

      expect(event.attempts).toBe(0);

      const persistedPayload = event.payload as {
        readonly eventId?: unknown;
      };

      expect(persistedPayload.eventId).toBeTypeOf('string');

      expect(event.dedupeKey).toBe(
        `learning.enrollment:${persistedPayload.eventId}`,
      );

      const payload = event.payload as {
        readonly eventId?: unknown;
        readonly eventName?: unknown;
        readonly eventVersion?: unknown;
        readonly aggregateId?: unknown;
        readonly occurredAt?: unknown;
        readonly payload?: unknown;
      };

      expect(payload.eventId).toBeTypeOf('string');

      expect(payload.eventName).toBe(EnrollmentDomainEventName.CREATED);

      expect(payload.eventVersion).toBe(1);

      expect(payload.aggregateId).toBe(enrollment.id);

      expect(payload.occurredAt).toBeTypeOf('string');

      expect(payload.payload).toBeDefined();

      /*
       * Successful commit drains the aggregate's pending domain events.
       */
      expect(enrollment.getDomainEvents()).toHaveLength(0);
    });

    it('persists an Enrollment only together with its corresponding Outbox event', async () => {
      const fixture = await createCourseFixture();

      const enrollment = Enrollment.create({
        learnerId: learnerId('atomic-direct-repository'),
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      await enrollmentRepository.save(enrollment);

      const persistedEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: enrollment.id,
        },
      });

      const outboxCount = await prisma.outboxEvent.count({
        where: {
          aggregateType: 'Enrollment',
          aggregateId: enrollment.id,
        },
      });

      expect(persistedEnrollment).not.toBeNull();

      expect(outboxCount).toBe(1);

      expect(enrollment.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Rollback semantics', () => {
    it('rolls back Enrollment and Outbox together when Outbox persistence fails', async () => {
      const fixture = await createCourseFixture();

      const enrollment = Enrollment.create({
        learnerId: learnerId('rollback'),
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const event = enrollment.getDomainEvents().at(0);

      expect(event).toBeDefined();

      if (event === undefined) {
        throw new Error('EnrollmentCreated event was not generated.');
      }

      const conflictingDedupeKey = `learning.enrollment:${event.eventId}`;

      const existingOutbox = await prisma.outboxEvent.create({
        data: {
          eventType: event.eventName,
          aggregateType: 'Enrollment',
          aggregateId: enrollment.id,
          dedupeKey: conflictingDedupeKey,
          payload: JSON.parse(
            JSON.stringify({
              eventId: event.eventId,
              eventName: event.eventName,
              eventVersion: event.eventVersion,
              aggregateId: event.aggregateId,
              occurredAt: event.occurredAt,
              payload: event.payload,
            }),
          ),
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
        },
      });

      createdOutboxIds.add(existingOutbox.id);

      await expect(
        enrollmentRepository.save(enrollment),
      ).rejects.toBeInstanceOf(PrismaRepositoryError);

      const persistedEnrollment = await prisma.enrollment.findUnique({
        where: {
          id: enrollment.id,
        },
      });

      expect(persistedEnrollment).toBeNull();

      const conflictingRows = await prisma.outboxEvent.findMany({
        where: {
          dedupeKey: conflictingDedupeKey,
        },
      });

      expect(conflictingRows).toHaveLength(1);

      expect(conflictingRows[0]?.id).toBe(existingOutbox.id);

      /*
       * The transaction failed before post-commit event draining.
       * Therefore the aggregate must retain its pending domain event.
       */
      expect(enrollment.getDomainEvents()).toHaveLength(1);

      expect(enrollment.getDomainEvents()[0]?.eventId).toBe(event.eventId);
    });
  });

  describe('Duplicate concurrency', () => {
    it('allows exactly one concurrent active Enrollment for the same learner and Course', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('concurrent');

      const first = Enrollment.create({
        learnerId: learner,
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      const second = Enrollment.create({
        learnerId: learner,
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(first.id);

      createdEnrollmentIds.add(second.id);

      const results = await Promise.allSettled([
        enrollmentRepository.save(first),
        enrollmentRepository.save(second),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);

      expect(rejected).toHaveLength(1);

      const rejectedReason = rejected[0]?.reason;

      expect(rejectedReason).toBeInstanceOf(PrismaRepositoryError);

      expect((rejectedReason as PrismaRepositoryError).code).toBe(
        PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      );

      expect((rejectedReason as PrismaRepositoryError).prismaCode).toBe(
        'P2002',
      );

      const activeCount = await prisma.enrollment.count({
        where: {
          learnerId: learner,
          courseId: fixture.courseId,
          status: {
            in: ['PENDING', 'ACTIVE'],
          },
        },
      });

      expect(activeCount).toBe(1);
    });

    it('fast-fails a sequential duplicate through the application service', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('sequential-duplicate');

      const first = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(first.id);

      try {
        await enrollmentService.enrollLearner({
          learnerId: learner,
          courseId: fixture.courseId,
          source: EnrollmentSource.DIRECT,
        });

        throw new Error('Expected duplicate Enrollment to be rejected.');
      } catch (error) {
        expectEnrollmentDomainError(
          error,
          EnrollmentDomainErrorCode.DUPLICATE_ACTIVE,
        );
      }

      const count = await prisma.enrollment.count({
        where: {
          learnerId: learner,
          courseId: fixture.courseId,
          status: {
            in: ['PENDING', 'ACTIVE'],
          },
        },
      });

      expect(count).toBe(1);
    });
  });

  describe('Unique-constraint error mapping', () => {
    it('maps PostgreSQL P2002 to PRISMA_REPOSITORY_UNIQUE_CONSTRAINT without swallowing the error', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('unique-mapping');

      const first = Enrollment.create({
        learnerId: learner,
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      await enrollmentRepository.save(first);

      createdEnrollmentIds.add(first.id);

      const second = Enrollment.create({
        learnerId: learner,
        courseId: fixture.courseId,
        courseVersionId: fixture.publishedVersionId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(second.id);

      try {
        await enrollmentRepository.save(second);

        throw new Error('Expected PostgreSQL unique constraint violation.');
      } catch (error) {
        expect(error).toBeInstanceOf(PrismaRepositoryError);

        const repositoryError = error as PrismaRepositoryError;

        expect(repositoryError.code).toBe(
          PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
        );

        expect(repositoryError.prismaCode).toBe('P2002');

        expect(repositoryError.cause).toBeDefined();
      }
    });
  });

  describe('Terminal-state re-enrollment', () => {
    it('allows re-enrollment after cancellation', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('after-cancel');

      const original = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(original.id);

      original.cancel();

      await enrollmentRepository.save(original);

      const replacement = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(replacement.id);

      expect(replacement.id).not.toBe(original.id);

      expect(replacement.status).toBe(EnrollmentStatus.ACTIVE);

      const historical = await prisma.enrollment.findUnique({
        where: {
          id: original.id,
        },
      });

      expect(historical?.status).toBe('CANCELLED');
    });

    it('allows re-enrollment after completion', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('after-complete');

      const original = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(original.id);

      original.complete();

      await enrollmentRepository.save(original);

      const replacement = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(replacement.id);

      expect(replacement.id).not.toBe(original.id);

      expect(replacement.status).toBe(EnrollmentStatus.ACTIVE);

      const historical = await prisma.enrollment.findUnique({
        where: {
          id: original.id,
        },
      });

      expect(historical?.status).toBe('COMPLETED');
    });

    it('allows re-enrollment after expiration', async () => {
      const fixture = await createCourseFixture();

      const learner = learnerId('after-expire');

      const original = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(original.id);

      original.expire();

      await enrollmentRepository.save(original);

      const replacement = await enrollmentService.enrollLearner({
        learnerId: learner,
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(replacement.id);

      expect(replacement.id).not.toBe(original.id);

      expect(replacement.status).toBe(EnrollmentStatus.ACTIVE);

      const historical = await prisma.enrollment.findUnique({
        where: {
          id: original.id,
        },
      });

      expect(historical?.status).toBe('EXPIRED');
    });
  });

  describe('Rehydration', () => {
    it('rehydrates the persisted Enrollment without generating new domain events', async () => {
      const fixture = await createCourseFixture();

      const created = await enrollmentService.enrollLearner({
        learnerId: learnerId('rehydration'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(created.id);

      const rehydrated = await enrollmentService.getEnrollment({
        enrollmentId: created.id,
      });

      expect(rehydrated).not.toBeNull();

      expect(rehydrated?.id).toBe(created.id);

      expect(rehydrated?.learnerId).toBe(created.learnerId);

      expect(rehydrated?.courseId).toBe(created.courseId);

      expect(rehydrated?.courseVersionId).toBe(created.courseVersionId);

      expect(rehydrated?.status).toBe(created.status);

      expect(rehydrated?.source).toBe(created.source);

      expect(rehydrated?.startsAt).toEqual(created.startsAt);

      expect(rehydrated?.expiresAt).toEqual(created.expiresAt);

      expect(rehydrated?.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Transactional event envelope', () => {
    it('persists the complete EnrollmentCreated event envelope', async () => {
      const fixture = await createCourseFixture();

      const enrollment = await enrollmentService.enrollLearner({
        learnerId: learnerId('event-envelope'),
        courseId: fixture.courseId,
        source: EnrollmentSource.DIRECT,
      });

      createdEnrollmentIds.add(enrollment.id);

      const event = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'Enrollment',
          aggregateId: enrollment.id,
        },
      });

      expect(event).not.toBeNull();

      if (event === null) {
        throw new Error('Expected Enrollment Outbox event to exist.');
      }

      expect(event.eventType).toBe(EnrollmentDomainEventName.CREATED);

      expect(event.aggregateType).toBe('Enrollment');

      expect(event.aggregateId).toBe(enrollment.id);

      expect(event.dedupeKey).toMatch(/^learning\.enrollment:/);

      const payload = event.payload as {
        readonly eventId: string;
        readonly eventName: string;
        readonly eventVersion: number;
        readonly aggregateId: string;
        readonly occurredAt: string;
        readonly payload: {
          readonly enrollmentId: string;
          readonly learnerId: string;
          readonly courseId: string;
          readonly courseVersionId: string;
          readonly status: string;
          readonly source: string;
          readonly startsAt: string;
          readonly expiresAt: string | null;
        };
      };

      expect(payload.eventId).toBeTypeOf('string');

      expect(payload.eventName).toBe(EnrollmentDomainEventName.CREATED);

      expect(payload.eventVersion).toBe(1);

      expect(payload.aggregateId).toBe(enrollment.id);

      expect(payload.occurredAt).toBeTypeOf('string');

      expect(payload.payload.enrollmentId).toBe(enrollment.id);

      expect(payload.payload.learnerId).toBe(enrollment.learnerId);

      expect(payload.payload.courseId).toBe(enrollment.courseId);

      expect(payload.payload.courseVersionId).toBe(enrollment.courseVersionId);

      expect(payload.payload.status).toBe(enrollment.status);

      expect(payload.payload.source).toBe(enrollment.source);

      expect(payload.payload.startsAt).toBeTypeOf('string');

      expect(payload.payload.expiresAt).toBeNull();
    });
  });
});
