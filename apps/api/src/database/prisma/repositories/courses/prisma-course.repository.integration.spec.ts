import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  Course,
  CourseActorId,
  CourseId,
  CourseLevel,
  CourseOwnership,
  CourseOwnershipRole,
  CourseStatus,
  CourseType,
  CourseVisibility,
  createCourseOwnershipAssignment,
} from '@gurusthalam/courses';

import { PrismaService } from '../../prisma.service.js';

import { PrismaCourseRepository } from './prisma-course.repository.js';

describe('PrismaCourseRepository - PostgreSQL integration', () => {
  const prisma = new PrismaService();

  const repository = new PrismaCourseRepository(prisma);

  const createdCourseIds: string[] = [];

  beforeAll(async () => {
    await prisma.onModuleInit();
  });

  afterEach(async () => {
    for (const courseId of createdCourseIds) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: 'Course',
          aggregateId: courseId,
        },
      });

      await prisma.courseOwnershipAssignment.deleteMany({
        where: {
          courseId,
        },
      });

      await prisma.course.deleteMany({
        where: {
          id: courseId,
        },
      });
    }

    createdCourseIds.length = 0;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  const trackCourse = (course: Course): void => {
    createdCourseIds.push(course.id.toString());
  };

  const createCourse = (
    ownership: CourseOwnership = CourseOwnership.create(),
  ): Course =>
    Course.create({
      title: `Repository Integration ${randomUUID()}`,
      description: 'PostgreSQL repository integration test course.',
      level: CourseLevel.BEGINNER,
      type: CourseType.SELF_PACED,
      visibility: CourseVisibility.PRIVATE,
      instructorId: `integration-instructor-${randomUUID()}`,
      ownership,
    });

  it('persists and rehydrates a Course with its ownership state', async () => {
    const ownerAssignment = createCourseOwnershipAssignment({
      principalId: CourseActorId.from(`integration-owner-${randomUUID()}`),
      role: CourseOwnershipRole.OWNER,
    });

    const authorAssignment = createCourseOwnershipAssignment({
      principalId: CourseActorId.from(`integration-author-${randomUUID()}`),
      role: CourseOwnershipRole.AUTHOR,
    });

    const course = createCourse(
      CourseOwnership.create([ownerAssignment, authorAssignment]),
    );

    trackCourse(course);

    const creationEvents = course.getDomainEvents();

    expect(creationEvents).toHaveLength(1);

    await repository.save(course);

    /**
     * A successful repository save persists the pending domain events
     * into the transactional Outbox and drains them only after the
     * transaction commits successfully.
     */
    expect(course.getDomainEvents()).toHaveLength(0);

    const stored = await repository.findById(course.id);

    expect(stored).not.toBeNull();

    if (stored === null) {
      throw new Error('Expected the persisted Course to be rehydrated.');
    }

    expect(stored).not.toBe(course);

    expect(stored.id.toString()).toBe(course.id.toString());

    expect(stored.title).toBe(course.title);

    expect(stored.description).toBe(course.description);

    expect(stored.level).toBe(course.level);

    expect(stored.type).toBe(course.type);

    expect(stored.visibility).toBe(course.visibility);

    expect(stored.status).toBe(CourseStatus.DRAFT);

    expect(stored.instructorId).toBe(course.instructorId);

    expect(stored.createdAt.getTime()).toBe(course.createdAt.getTime());

    expect(stored.updatedAt.getTime()).toBe(course.updatedAt.getTime());

    expect(stored.ownership.size).toBe(2);

    expect(stored.ownership.getOwner()?.principalId.toString()).toBe(
      ownerAssignment.principalId.toString(),
    );

    expect(
      stored.ownership
        .getForRole(CourseOwnershipRole.AUTHOR)[0]
        ?.principalId.toString(),
    ).toBe(authorAssignment.principalId.toString());

    /*
     * Rehydration must not manufacture a new domain event.
     */
    expect(stored.getDomainEvents()).toHaveLength(0);
  });

  it('persists lifecycle state changes and rehydrates the updated aggregate', async () => {
    const course = createCourse();

    trackCourse(course);

    await repository.save(course);

    const previousUpdatedAt = course.updatedAt.getTime();

    course.submitForReview();

    expect(course.status).toBe(CourseStatus.IN_REVIEW);

    expect(course.updatedAt.getTime()).toBeGreaterThanOrEqual(
      previousUpdatedAt,
    );

    await repository.save(course);

    const stored = await repository.findById(course.id);

    expect(stored).not.toBeNull();

    if (stored === null) {
      throw new Error('Expected the persisted Course to be rehydrated.');
    }

    expect(stored.status).toBe(CourseStatus.IN_REVIEW);

    expect(stored.id.toString()).toBe(course.id.toString());

    expect(stored.getDomainEvents()).toHaveLength(0);
  });

  it('synchronizes changed ownership state atomically with the Course', async () => {
    const ownerAssignment = createCourseOwnershipAssignment({
      principalId: CourseActorId.from(`integration-owner-${randomUUID()}`),
      role: CourseOwnershipRole.OWNER,
    });

    const authorAssignment = createCourseOwnershipAssignment({
      principalId: CourseActorId.from(`integration-author-${randomUUID()}`),
      role: CourseOwnershipRole.AUTHOR,
    });

    const course = createCourse(CourseOwnership.create([ownerAssignment]));

    trackCourse(course);

    await repository.save(course);

    let stored = await repository.findById(course.id);

    expect(stored).not.toBeNull();

    if (stored === null) {
      throw new Error('Expected the initially persisted Course to be found.');
    }

    expect(stored.ownership.size).toBe(1);

    expect(stored.ownership.getOwner()?.principalId.toString()).toBe(
      ownerAssignment.principalId.toString(),
    );

    course.replaceOwnership(CourseOwnership.create([authorAssignment]));

    await repository.save(course);

    stored = await repository.findById(course.id);

    expect(stored).not.toBeNull();

    if (stored === null) {
      throw new Error('Expected the updated Course to be found.');
    }

    expect(stored.ownership.size).toBe(1);

    expect(stored.ownership.getOwner()).toBeNull();

    expect(
      stored.ownership
        .getForRole(CourseOwnershipRole.AUTHOR)[0]
        ?.principalId.toString(),
    ).toBe(authorAssignment.principalId.toString());

    const persistedOwnership = await prisma.courseOwnershipAssignment.findMany({
      where: {
        courseId: course.id.toString(),
      },
      orderBy: {
        position: 'asc',
      },
    });

    expect(persistedOwnership).toHaveLength(1);

    expect(persistedOwnership[0]?.principalId).toBe(
      authorAssignment.principalId.toString(),
    );

    expect(persistedOwnership[0]?.role).toBe(CourseOwnershipRole.AUTHOR);

    expect(persistedOwnership[0]?.position).toBe(0);
  });

  it('reports existence correctly without hydrating ownership', async () => {
    const course = createCourse();

    trackCourse(course);

    await repository.save(course);

    await expect(repository.exists(course.id)).resolves.toBe(true);

    const missingCourseId = CourseId.generate();

    await expect(repository.exists(missingCourseId)).resolves.toBe(false);
  });

  it('returns null when a Course does not exist', async () => {
    const missingCourseId = CourseId.generate();

    await expect(repository.findById(missingCourseId)).resolves.toBeNull();
  });
});
