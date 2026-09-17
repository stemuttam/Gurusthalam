import { describe, expect, it, vi } from 'vitest';

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

import type { PrismaClient } from '@gurusthalam/database';

import { PrismaCourseRepository } from './prisma-course.repository.js';

describe('PrismaCourseRepository', () => {
  const findUnique = vi.fn();

  /*
   * Root Prisma and transaction-scoped Course upsert mocks
   * are intentionally separate so an accidental use of
   * this.prisma.course.upsert() inside the transaction can
   * be detected by the tests.
   */
  const rootCourseUpsert = vi.fn();

  const transactionCourseUpsert = vi.fn();

  const ownershipFindMany = vi.fn();

  const ownershipDeleteMany = vi.fn();

  const ownershipCreateMany = vi.fn();

  const transaction = vi.fn();

  const transactionClient = {
    course: {
      upsert: transactionCourseUpsert,
    },

    courseOwnershipAssignment: {
      findMany: ownershipFindMany,

      deleteMany: ownershipDeleteMany,

      createMany: ownershipCreateMany,
    },
  };

  const configureTransaction = (): void => {
    transaction.mockImplementation(
      async (callback: (client: typeof transactionClient) => Promise<void>) =>
        callback(transactionClient),
    );
  };

  const prisma = {
    course: {
      findUnique,

      upsert: rootCourseUpsert,
    },

    $transaction: transaction,
  } as unknown as PrismaClient;

  const repository = new PrismaCourseRepository(prisma);

  const courseId = CourseId.from('course-001');

  const ownerAssignment = createCourseOwnershipAssignment({
    principalId: CourseActorId.from('owner-001'),

    role: CourseOwnershipRole.OWNER,
  });

  const authorAssignment = createCourseOwnershipAssignment({
    principalId: CourseActorId.from('author-001'),

    role: CourseOwnershipRole.AUTHOR,
  });

  const createCourse = (
    ownership: readonly ReturnType<
      typeof createCourseOwnershipAssignment
    >[] = [],
  ): Course =>
    Course.rehydrate(
      {
        id: courseId,

        title: 'TypeScript Fundamentals',

        description: 'Learn TypeScript from the ground up.',

        level: CourseLevel.BEGINNER,

        type: CourseType.SELF_PACED,

        visibility: CourseVisibility.PUBLIC,

        status: CourseStatus.DRAFT,

        instructorId: 'instructor-001',

        createdAt: new Date('2026-01-01T10:00:00.000Z'),

        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },

      CourseOwnership.create(ownership),
    );

  const resetMocks = (): void => {
    findUnique.mockReset();

    rootCourseUpsert.mockReset();

    transactionCourseUpsert.mockReset();

    ownershipFindMany.mockReset();

    ownershipDeleteMany.mockReset();

    ownershipCreateMany.mockReset();

    transaction.mockReset();

    configureTransaction();
  };

  it('finds a Course and rehydrates its ownership', async () => {
    resetMocks();

    findUnique.mockResolvedValue({
      id: 'course-001',

      title: 'TypeScript Fundamentals',

      description: 'Learn TypeScript from the ground up.',

      level: 'BEGINNER',

      type: 'SELF_PACED',

      visibility: 'PUBLIC',

      status: 'DRAFT',

      instructorId: 'instructor-001',

      createdAt: new Date('2026-01-01T10:00:00.000Z'),

      updatedAt: new Date('2026-01-01T10:00:00.000Z'),

      ownershipAssignments: [
        {
          courseId: 'course-001',

          principalId: 'author-001',

          role: 'AUTHOR',

          position: 1,
        },

        {
          courseId: 'course-001',

          principalId: 'owner-001',

          role: 'OWNER',

          position: 0,
        },
      ],
    });

    const result = await repository.findById(courseId);

    expect(findUnique).toHaveBeenCalledTimes(1);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-001',
      },

      include: {
        ownershipAssignments: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    expect(result).toBeInstanceOf(Course);

    expect(result?.id.value).toBe('course-001');

    expect(result?.title).toBe('TypeScript Fundamentals');

    expect(result?.instructorId).toBe('instructor-001');

    expect(result?.ownership.size).toBe(2);

    expect(result?.ownership.getOwner()?.principalId.toString()).toBe(
      'owner-001',
    );

    expect(
      result?.ownership
        .getForRole(CourseOwnershipRole.AUTHOR)[0]
        ?.principalId.toString(),
    ).toBe('author-001');

    expect(result?.getDomainEvents()).toHaveLength(0);
  });

  it('returns null when the Course does not exist', async () => {
    resetMocks();

    findUnique.mockResolvedValue(null);

    await expect(repository.findById(courseId)).resolves.toBeNull();

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-001',
      },

      include: {
        ownershipAssignments: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  });

  it('checks Course existence using an id-only projection', async () => {
    resetMocks();

    findUnique.mockResolvedValue({
      id: 'course-001',
    });

    await expect(repository.exists(courseId)).resolves.toBe(true);

    expect(findUnique).toHaveBeenCalledTimes(1);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-001',
      },

      select: {
        id: true,
      },
    });
  });

  it('returns false when the Course does not exist', async () => {
    resetMocks();

    findUnique.mockResolvedValue(null);

    await expect(repository.exists(courseId)).resolves.toBe(false);

    expect(findUnique).toHaveBeenCalledTimes(1);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-001',
      },

      select: {
        id: true,
      },
    });
  });

  it('persists Course and changed ownership atomically in one transaction', async () => {
    resetMocks();

    const course = createCourse([ownerAssignment, authorAssignment]);

    /*
     * Database currently contains no ownership rows,
     * while the aggregate contains two assignments.
     * Ownership must therefore be synchronized.
     */
    ownershipFindMany.mockResolvedValue([]);

    await expect(repository.save(course)).resolves.toBeUndefined();

    expect(transaction).toHaveBeenCalledTimes(1);

    /*
     * Course persistence must use the transaction client.
     */
    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(transactionCourseUpsert).toHaveBeenCalledWith({
      where: {
        id: 'course-001',
      },

      create: {
        id: 'course-001',

        title: 'TypeScript Fundamentals',

        description: 'Learn TypeScript from the ground up.',

        level: 'BEGINNER',

        type: 'SELF_PACED',

        visibility: 'PUBLIC',

        status: 'DRAFT',

        instructorId: 'instructor-001',

        createdAt: new Date('2026-01-01T10:00:00.000Z'),

        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },

      update: {
        title: 'TypeScript Fundamentals',

        description: 'Learn TypeScript from the ground up.',

        level: 'BEGINNER',

        type: 'SELF_PACED',

        visibility: 'PUBLIC',

        status: 'DRAFT',

        instructorId: 'instructor-001',

        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    });

    /*
     * Root Prisma Course upsert must never be used inside
     * the transaction callback.
     */
    expect(rootCourseUpsert).not.toHaveBeenCalled();

    expect(ownershipFindMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-001',
      },

      select: {
        principalId: true,

        role: true,

        position: true,
      },

      orderBy: {
        position: 'asc',
      },
    });

    expect(ownershipDeleteMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-001',
      },
    });

    expect(ownershipCreateMany).toHaveBeenCalledWith({
      data: [
        {
          courseId: 'course-001',

          principalId: 'owner-001',

          role: 'OWNER',

          position: 0,
        },

        {
          courseId: 'course-001',

          principalId: 'author-001',

          role: 'AUTHOR',

          position: 1,
        },
      ],
    });
  });

  it('does not rewrite unchanged ownership assignments', async () => {
    resetMocks();

    const course = createCourse([ownerAssignment, authorAssignment]);

    ownershipFindMany.mockResolvedValue([
      {
        principalId: 'owner-001',

        role: 'OWNER',

        position: 0,
      },

      {
        principalId: 'author-001',

        role: 'AUTHOR',

        position: 1,
      },
    ]);

    await repository.save(course);

    expect(transaction).toHaveBeenCalledTimes(1);

    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(rootCourseUpsert).not.toHaveBeenCalled();

    expect(ownershipFindMany).toHaveBeenCalledTimes(1);

    expect(ownershipDeleteMany).not.toHaveBeenCalled();

    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });

  it('replaces changed ownership assignments atomically', async () => {
    resetMocks();

    const course = createCourse([authorAssignment]);

    ownershipFindMany.mockResolvedValue([
      {
        principalId: 'owner-001',

        role: 'OWNER',

        position: 0,
      },
    ]);

    await repository.save(course);

    expect(transaction).toHaveBeenCalledTimes(1);

    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(rootCourseUpsert).not.toHaveBeenCalled();

    expect(ownershipDeleteMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-001',
      },
    });

    expect(ownershipCreateMany).toHaveBeenCalledWith({
      data: [
        {
          courseId: 'course-001',

          principalId: 'author-001',

          role: 'AUTHOR',

          position: 0,
        },
      ],
    });
  });

  it('removes all persisted ownership when aggregate ownership is empty', async () => {
    resetMocks();

    const course = createCourse();

    ownershipFindMany.mockResolvedValue([
      {
        principalId: 'owner-001',

        role: 'OWNER',

        position: 0,
      },
    ]);

    await repository.save(course);

    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(rootCourseUpsert).not.toHaveBeenCalled();

    expect(ownershipDeleteMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-001',
      },
    });

    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });

  it('uses the aggregate identifier as the Course upsert key', async () => {
    resetMocks();

    ownershipFindMany.mockResolvedValue([]);

    await repository.save(createCourse());

    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(transactionCourseUpsert.mock.calls[0]?.[0]?.where).toEqual({
      id: courseId.value,
    });

    expect(rootCourseUpsert).not.toHaveBeenCalled();
  });

  it('does not perform ownership writes when the transactional Course upsert fails', async () => {
    resetMocks();

    transactionCourseUpsert.mockRejectedValue({
      code: 'P2002',

      message: 'Unique constraint failed',
    });

    await expect(
      repository.save(createCourse([ownerAssignment])),
    ).rejects.toThrow();

    expect(transaction).toHaveBeenCalledTimes(1);

    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    expect(rootCourseUpsert).not.toHaveBeenCalled();

    /*
     * The transaction callback terminates immediately when
     * the Course upsert fails.
     */
    expect(ownershipFindMany).not.toHaveBeenCalled();

    expect(ownershipDeleteMany).not.toHaveBeenCalled();

    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });

  it('does not bypass the transactional boundary for Course or ownership persistence', async () => {
    resetMocks();

    ownershipFindMany.mockResolvedValue([]);

    await repository.save(createCourse([ownerAssignment]));

    expect(transaction).toHaveBeenCalledTimes(1);

    /*
     * Course persistence must use:
     * transaction.course.upsert()
     */
    expect(transactionCourseUpsert).toHaveBeenCalledTimes(1);

    /*
     * Root:
     * this.prisma.course.upsert()
     *
     * must not be called.
     */
    expect(rootCourseUpsert).not.toHaveBeenCalled();

    /*
     * Ownership persistence must also use the transaction client.
     */
    expect(ownershipFindMany).toHaveBeenCalledTimes(1);

    expect(ownershipCreateMany).toHaveBeenCalledTimes(1);

    expect(ownershipDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('preserves Course ownership value-object invariants before persistence', async () => {
    resetMocks();

    /*
     * CourseOwnership must reject multiple OWNER assignments.
     *
     * The exception is intentionally created inside the expect
     * callback so Vitest can assert the domain validation behavior.
     */
    expect(() =>
      CourseOwnership.create([
        ownerAssignment,

        createCourseOwnershipAssignment({
          principalId: CourseActorId.from('second-owner'),

          role: CourseOwnershipRole.OWNER,
        }),
      ]),
    ).toThrow('Course ownership contains multiple Owners.');

    /*
     * Invalid domain state must never reach persistence.
     */
    expect(transaction).not.toHaveBeenCalled();

    expect(transactionCourseUpsert).not.toHaveBeenCalled();

    expect(rootCourseUpsert).not.toHaveBeenCalled();

    expect(ownershipFindMany).not.toHaveBeenCalled();

    expect(ownershipDeleteMany).not.toHaveBeenCalled();

    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });
});
