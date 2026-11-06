import { Module } from '@nestjs/common';

import type { QuestionVersionRepository } from '@gurusthalam/question-bank';

import { DatabaseModule } from '../../../database.module.js';

import { PrismaService } from '../../prisma.service.js';

import { QUESTION_VERSION_REPOSITORY } from './question-bank-repository.tokens.js';

import { PrismaQuestionVersionRepository } from './prisma-question-version.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: QUESTION_VERSION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): QuestionVersionRepository =>
        new PrismaQuestionVersionRepository(prisma),
    },
  ],
  exports: [QUESTION_VERSION_REPOSITORY],
})
export class QuestionBankPersistenceModule {}
