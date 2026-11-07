import { describe, expect, it } from 'vitest';

import { Test } from '@nestjs/testing';

import type { QuestionVersionRepository } from '@gurusthalam/question-bank';

import { PrismaService } from '../../prisma.service.js';

import {
  QUESTION_VERSION_REPOSITORY,
  QuestionBankPersistenceModule,
  PrismaQuestionVersionRepository,
} from './index.js';

describe('QuestionBankPersistenceModule', () => {
  const createTestingModule = async () => {
    const prisma = {} as PrismaService;

    const moduleRef = await Test.createTestingModule({
      imports: [QuestionBankPersistenceModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    return { moduleRef, prisma };
  };

  it('resolves the QuestionVersion repository using its exported token', async () => {
    const { moduleRef } = await createTestingModule();

    try {
      const repository = moduleRef.get<QuestionVersionRepository>(
        QUESTION_VERSION_REPOSITORY,
      );

      expect(repository).toBeInstanceOf(PrismaQuestionVersionRepository);
    } finally {
      await moduleRef.close();
    }
  });

  it('resolves the repository as a singleton', async () => {
    const { moduleRef } = await createTestingModule();

    try {
      const first = moduleRef.get<QuestionVersionRepository>(
        QUESTION_VERSION_REPOSITORY,
      );

      const second = moduleRef.get<QuestionVersionRepository>(
        QUESTION_VERSION_REPOSITORY,
      );

      expect(first).toBe(second);
    } finally {
      await moduleRef.close();
    }
  });

  it('uses the PrismaService provider registered by DatabaseModule', async () => {
    const { moduleRef, prisma } = await createTestingModule();

    try {
      const injectedPrisma = moduleRef.get(PrismaService);

      expect(injectedPrisma).toBe(prisma);

      const repository = moduleRef.get<PrismaQuestionVersionRepository>(
        QUESTION_VERSION_REPOSITORY,
      );

      expect(repository).toBeInstanceOf(PrismaQuestionVersionRepository);
    } finally {
      await moduleRef.close();
    }
  });
});
