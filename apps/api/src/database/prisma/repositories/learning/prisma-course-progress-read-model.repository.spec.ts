import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CourseProgressReadModelTimestampConflictError,
  CourseProgressReadModelVersionConflictError,
  type CourseProgressReadModel,
} from '@gurusthalam/learning';

import { PrismaService } from '../../prisma.service.js';
import { PrismaCourseProgressReadModelRepository } from './prisma-course-progress-read-model.repository.js';

import { PrismaRepositoryErrorCode } from '../prisma-repository.error.js';

type Snapshot = CourseProgressReadModel;

type PersistedSnapshot = Snapshot & {
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

const ENROLLMENT_ID = 'enrollment-test-001';
const COURSE_VERSION_ID = 'course-version-test-001';
const OTHER_COURSE_VERSION_ID = 'course-version-test-002';

function createSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    enrollmentId: ENROLLMENT_ID,
    courseVersionId: COURSE_VERSION_ID,
    totalLearningUnits: 10,
    startedLearningUnits: 5,
    completedLearningUnits: 3,
    percentage: 50,
    hasLearningUnits: true,
    calculatedAt: new Date('2026-10-12T10:00:00.000Z'),
    ...overrides,
  };
}

function persisted(snapshot: Snapshot): PersistedSnapshot {
  return {
    ...snapshot,
    createdAt: new Date('2026-10-12T09:00:00.000Z'),
    updatedAt: new Date('2026-10-12T10:00:00.000Z'),
  };
}

function createHarness() {
  const findUnique = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const enrollmentRows = vi.fn();

  const transactionClient = {
    courseProgressReadModel: {
      findUnique,
      create,
      update,
    },
    $queryRaw: enrollmentRows,
  };

  const rootFindUnique = vi.fn();

  const prisma = {
    courseProgressReadModel: {
      findUnique: rootFindUnique,
    },
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    ),
  };

  enrollmentRows.mockResolvedValue([
    {
      id: ENROLLMENT_ID,
      courseVersionId: COURSE_VERSION_ID,
    },
  ]);

  findUnique.mockResolvedValue(null);
  create.mockImplementation(async ({ data }) => persisted(data));
  update.mockImplementation(async ({ data }) => persisted(data));
  rootFindUnique.mockResolvedValue(null);

  const repository = new PrismaCourseProgressReadModelRepository(
    prisma as unknown as PrismaService,
  );

  return {
    repository,
    prisma,
    transactionClient,
    enrollmentRows,
    findUnique,
    create,
    update,
    rootFindUnique,
  };
}

describe('PrismaCourseProgressReadModelRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the first projection for an existing enrollment', async () => {
    const h = createHarness();
    const input = createSnapshot();

    h.findUnique.mockResolvedValue(null);
    h.create.mockResolvedValue(persisted(input));

    await expect(h.repository.save(input)).resolves.toEqual({
      outcome: 'created',
      readModel: input,
    });

    expect(h.enrollmentRows).toHaveBeenCalledTimes(1);
    expect(h.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: input.enrollmentId,
        courseVersionId: input.courseVersionId,
        totalLearningUnits: input.totalLearningUnits,
        startedLearningUnits: input.startedLearningUnits,
        completedLearningUnits: input.completedLearningUnits,
        percentage: input.percentage,
        hasLearningUnits: input.hasLearningUnits,
        calculatedAt: input.calculatedAt,
      },
    });
    expect(h.update).not.toHaveBeenCalled();
  });

  it('updates an existing projection when the incoming snapshot is newer', async () => {
    const h = createHarness();
    const existing = createSnapshot();
    const incoming = createSnapshot({
      startedLearningUnits: 7,
      completedLearningUnits: 5,
      percentage: 70,
      calculatedAt: new Date('2026-10-12T11:00:00.000Z'),
    });

    h.findUnique.mockResolvedValue(persisted(existing));
    h.update.mockResolvedValue(persisted(incoming));

    await expect(h.repository.save(incoming)).resolves.toEqual({
      outcome: 'updated',
      readModel: incoming,
    });

    expect(h.update).toHaveBeenCalledWith({
      where: { enrollmentId: incoming.enrollmentId },
      data: {
        courseVersionId: incoming.courseVersionId,
        totalLearningUnits: incoming.totalLearningUnits,
        startedLearningUnits: incoming.startedLearningUnits,
        completedLearningUnits: incoming.completedLearningUnits,
        percentage: incoming.percentage,
        hasLearningUnits: incoming.hasLearningUnits,
        calculatedAt: incoming.calculatedAt,
      },
    });
  });

  it('does not overwrite a newer projection with a stale snapshot', async () => {
    const h = createHarness();
    const incoming = createSnapshot();
    const newer = createSnapshot({
      percentage: 80,
      calculatedAt: new Date('2026-10-12T12:00:00.000Z'),
    });

    h.findUnique.mockResolvedValue(persisted(newer));

    await expect(h.repository.save(incoming)).resolves.toEqual({
      outcome: 'stale',
      readModel: newer,
    });

    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('treats an identical snapshot at the same timestamp as idempotent', async () => {
    const h = createHarness();
    const input = createSnapshot();

    h.findUnique.mockResolvedValue(persisted(input));

    await expect(h.repository.save(input)).resolves.toEqual({
      outcome: 'unchanged',
      readModel: input,
    });

    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('rejects different snapshot contents at the same timestamp', async () => {
    const h = createHarness();
    const existing = createSnapshot();
    const incoming = createSnapshot({ percentage: 65 });

    h.findUnique.mockResolvedValue(persisted(existing));

    await expect(h.repository.save(incoming)).rejects.toBeInstanceOf(
      CourseProgressReadModelTimestampConflictError,
    );

    expect(h.update).not.toHaveBeenCalled();
  });

  it('rejects a snapshot whose CourseVersion differs from the enrollment', async () => {
    const h = createHarness();
    const incoming = createSnapshot({
      courseVersionId: OTHER_COURSE_VERSION_ID,
    });

    await expect(h.repository.save(incoming)).rejects.toBeInstanceOf(
      CourseProgressReadModelVersionConflictError,
    );

    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('returns a typed record-not-found error for a missing enrollment', async () => {
    const h = createHarness();
    h.enrollmentRows.mockResolvedValue([]);

    await expect(h.repository.save(createSnapshot())).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: null,
    });

    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it('reads a projection by its enrollment identity', async () => {
    const h = createHarness();
    const input = createSnapshot();

    h.rootFindUnique.mockResolvedValue(persisted(input));

    await expect(
      h.repository.findByEnrollmentId(ENROLLMENT_ID),
    ).resolves.toEqual(input);

    expect(h.rootFindUnique).toHaveBeenCalledWith({
      where: { enrollmentId: ENROLLMENT_ID },
    });
  });

  it('returns null when no projection exists', async () => {
    const h = createHarness();
    h.rootFindUnique.mockResolvedValue(null);

    await expect(
      h.repository.findByEnrollmentId(ENROLLMENT_ID),
    ).resolves.toBeNull();
  });
});
