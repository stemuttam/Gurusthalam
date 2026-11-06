import { describe, expect, it, vi } from 'vitest';

import {
  AnswerFormat,
  QuestionId,
  QuestionType,
  QuestionVersionId,
  QuestionVersionLineage,
  QuestionVersionNumber,
  QuestionVersionReference,
  createQuestionVersionSnapshot,
  type AnyQuestionVersionSnapshotInput,
} from '@gurusthalam/question-bank';

import { PrismaQuestionVersionRepository } from './prisma-question-version.repository.js';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function createTrueFalseSnapshot() {
  const id = QuestionVersionId.from('version-true-false-1');
  const questionId = QuestionId.from('question-true-false-1');
  const versionNumber = QuestionVersionNumber.initial();

  const current = QuestionVersionReference.create(
    id,
    questionId,
    versionNumber,
  );

  return createQuestionVersionSnapshot({
    id,
    questionId,
    versionNumber,
    questionType: QuestionType.TRUE_FALSE,
    answerFormat: AnswerFormat.BOOLEAN,
    content: {
      questionType: 'TRUE_FALSE',
      prompt: { text: 'The Earth orbits the Sun.' },
    },
    answerKey: {
      questionType: 'TRUE_FALSE',
      correctValue: true,
    },
    lineage: QuestionVersionLineage.create(current, null, null),
    createdAt: CREATED_AT,
  } as AnyQuestionVersionSnapshotInput);
}

function createPrismaMock() {
  const calls: string[] = [];

  const transaction = {
    questionVersion: {
      create: vi.fn(async () => {
        calls.push('version.create');
        return {};
      }),
      update: vi.fn(async () => {
        calls.push('version.update');
        return {};
      }),
    },
    question: {
      upsert: vi.fn(async () => {
        calls.push('question.upsert');
        return {};
      }),
    },
    questionVersionContent: {
      create: vi.fn(async () => {
        calls.push('content.create');
        return {};
      }),
    },
    questionVersionOption: {
      createMany: vi.fn(async () => {
        calls.push('content.options.createMany');
        return { count: 0 };
      }),
    },
    questionVersionMatchingLeftItem: {
      createMany: vi.fn(async () => {
        calls.push('content.matchingLeft.createMany');
        return { count: 0 };
      }),
    },
    questionVersionMatchingRightItem: {
      createMany: vi.fn(async () => {
        calls.push('content.matchingRight.createMany');
        return { count: 0 };
      }),
    },
    questionVersionOrderingItem: {
      createMany: vi.fn(async () => {
        calls.push('content.ordering.createMany');
        return { count: 0 };
      }),
    },
    questionVersionFillBlankSegment: {
      createMany: vi.fn(async () => {
        calls.push('content.fillBlank.createMany');
        return { count: 0 };
      }),
    },
    questionVersionAnswerKey: {
      create: vi.fn(async () => {
        calls.push('answerKey.create');
        return {};
      }),
    },
    questionVersionOptionAnswer: {
      createMany: vi.fn(async () => {
        calls.push('answer.option.createMany');
        return { count: 0 };
      }),
    },
    questionVersionAcceptedAnswer: {
      createMany: vi.fn(async () => {
        calls.push('answer.accepted.createMany');
        return { count: 0 };
      }),
    },
    questionVersionMatchingPair: {
      createMany: vi.fn(async () => {
        calls.push('answer.matching.createMany');
        return { count: 0 };
      }),
    },
    questionVersionOrderingAnswer: {
      createMany: vi.fn(async () => {
        calls.push('answer.ordering.createMany');
        return { count: 0 };
      }),
    },
    questionVersionBlankAnswer: {
      createMany: vi.fn(async () => {
        calls.push('answer.blank.createMany');
        return { count: 0 };
      }),
    },
    questionVersionBlankAcceptedAnswer: {
      createMany: vi.fn(async () => {
        calls.push('answer.blankAccepted.createMany');
        return { count: 0 };
      }),
    },
  };

  const prisma = {
    questionVersion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };

  return { prisma, transaction, calls };
}

describe('PrismaQuestionVersionRepository', () => {
  it('persists the version and all required parent rows in one transaction', async () => {
    const { prisma, transaction, calls } = createPrismaMock();

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await repository.add(createTrueFalseSnapshot());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(transaction.question.upsert).toHaveBeenCalledWith({
      where: { id: 'question-true-false-1' },
      create: { id: 'question-true-false-1' },
      update: {},
    });

    expect(transaction.questionVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'version-true-false-1',
          questionId: 'question-true-false-1',
          versionNumber: 1n,
          questionType: 'TRUE_FALSE',
          answerFormat: 'BOOLEAN',
          completedAt: null,
        }),
      }),
    );

    expect(transaction.questionVersionContent.create).toHaveBeenCalled();
    expect(transaction.questionVersionAnswerKey.create).toHaveBeenCalled();

    expect(transaction.questionVersion.update).toHaveBeenCalledWith({
      where: { id: 'version-true-false-1' },
      data: { completedAt: CREATED_AT },
    });

    expect(calls.indexOf('version.create')).toBeLessThan(
      calls.indexOf('content.create'),
    );

    expect(calls.indexOf('content.create')).toBeLessThan(
      calls.indexOf('answerKey.create'),
    );

    expect(calls.indexOf('answerKey.create')).toBeLessThan(
      calls.indexOf('version.update'),
    );
  });

  it('does not upsert or update an existing QuestionVersion', async () => {
    const { prisma, transaction } = createPrismaMock();

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await repository.add(createTrueFalseSnapshot());

    expect(transaction.questionVersion.create).toHaveBeenCalledTimes(1);
    expect(transaction.questionVersion.update).toHaveBeenCalledTimes(1);

    // The only version update is the one-time completion marker.
    expect(transaction.questionVersion.update).toHaveBeenCalledWith({
      where: { id: 'version-true-false-1' },
      data: { completedAt: CREATED_AT },
    });

    expect(
      (transaction.questionVersion as unknown as { upsert?: unknown }).upsert,
    ).toBeUndefined();
  });

  it('propagates a transaction failure through the repository error boundary', async () => {
    const failure = new Error('simulated content persistence failure');
    const { prisma, transaction } = createPrismaMock();

    transaction.questionVersionContent.create.mockRejectedValueOnce(failure);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
    });

    expect(transaction.questionVersion.update).not.toHaveBeenCalled();
  });

  it('returns null when a version identifier does not exist', async () => {
    const { prisma } = createPrismaMock();

    prisma.questionVersion.findUnique.mockResolvedValueOnce(null);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.findById(QuestionVersionId.from('missing-version')),
    ).resolves.toBeNull();
  });

  it('checks existence using the composite Question/version identity', async () => {
    const { prisma } = createPrismaMock();

    prisma.questionVersion.findUnique.mockResolvedValueOnce({ id: 'found' });

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.existsByQuestionIdAndVersion(
        QuestionId.from('question-true-false-1'),
        QuestionVersionNumber.from(3),
      ),
    ).resolves.toBe(true);

    expect(prisma.questionVersion.findUnique).toHaveBeenCalledWith({
      where: {
        questionId_versionNumber: {
          questionId: 'question-true-false-1',
          versionNumber: 3n,
        },
      },
      select: { id: true },
    });
  });
});
