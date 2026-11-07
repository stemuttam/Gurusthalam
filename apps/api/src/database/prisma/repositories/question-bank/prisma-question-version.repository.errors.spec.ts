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

import { PrismaRepositoryErrorCode } from '../prisma-repository.error.js';

import { PrismaQuestionVersionRepository } from './prisma-question-version.repository.js';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function createTrueFalseSnapshot() {
  const id = QuestionVersionId.from('version-error-test-1');
  const questionId = QuestionId.from('question-error-test-1');
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
      prompt: {
        text: 'The Earth orbits the Sun.',
      },
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
  const transaction = {
    question: {
      upsert: vi.fn(async () => ({})),
    },
    questionVersion: {
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    questionVersionContent: {
      create: vi.fn(async () => ({})),
    },
    questionVersionAnswerKey: {
      create: vi.fn(async () => ({})),
    },
  };

  const prisma = {
    questionVersion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  return {
    prisma,
    transaction,
  };
}

describe('PrismaQuestionVersionRepository error translation', () => {
  it('translates duplicate version errors into UNIQUE_CONSTRAINT', async () => {
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint failed',
    };

    const { prisma, transaction } = createPrismaMock();

    transaction.questionVersion.create.mockRejectedValueOnce(prismaError);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
      prismaCode: 'P2002',
      cause: prismaError,
    });

    expect(transaction.questionVersion.update).not.toHaveBeenCalled();
  });

  it('translates foreign-key failures into FOREIGN_KEY_CONSTRAINT', async () => {
    const prismaError = {
      code: 'P2003',
      message: 'Foreign key constraint failed',
    };

    const { prisma, transaction } = createPrismaMock();

    transaction.questionVersion.create.mockRejectedValueOnce(prismaError);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
      prismaCode: 'P2003',
      cause: prismaError,
    });

    expect(transaction.questionVersion.update).not.toHaveBeenCalled();
  });

  it('translates missing-record failures into RECORD_NOT_FOUND', async () => {
    const prismaError = {
      code: 'P2025',
      message: 'Required record was not found',
    };

    const { prisma, transaction } = createPrismaMock();

    transaction.questionVersion.update.mockRejectedValueOnce(prismaError);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
      prismaCode: 'P2025',
      cause: prismaError,
    });
  });

  it('translates transaction conflicts into CONCURRENT_MODIFICATION', async () => {
    const prismaError = {
      code: 'P2034',
      message: 'Transaction failed due to a write conflict',
    };

    const { prisma } = createPrismaMock();

    prisma.$transaction.mockRejectedValueOnce(prismaError);

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION,
      prismaCode: 'P2034',
      cause: prismaError,
    });
  });

  it('preserves unknown failures as PERSISTENCE_FAILURE', async () => {
    const originalError = new Error('Simulated database connection failure');

    const { prisma, transaction } = createPrismaMock();

    transaction.questionVersionContent.create.mockRejectedValueOnce(
      originalError,
    );

    const repository = new PrismaQuestionVersionRepository(prisma as never);

    await expect(
      repository.add(createTrueFalseSnapshot()),
    ).rejects.toMatchObject({
      name: 'PrismaRepositoryError',
      code: PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
      prismaCode: null,
      cause: originalError,
    });

    expect(transaction.questionVersion.update).not.toHaveBeenCalled();
  });
});
