
import { Module } from '@nestjs/common';

import type {
  QuestionAssignmentRepository,
  QuestionLifecycleRepository,
  QuestionVersionRepository,
} from '@gurusthalam/question-bank';

import { DatabaseModule } from '../../../database.module.js';
import { PrismaService } from '../../prisma.service.js';

import {
  QUESTION_ASSIGNMENT_REPOSITORY,
  QUESTION_LIFECYCLE_REPOSITORY,
  QUESTION_VERSION_REPOSITORY,
} from './question-bank-repository.tokens.js';

import { PrismaQuestionAssignmentRepository } from './prisma-question-assignment.repository.js';
import { PrismaQuestionLifecycleRepository } from './prisma-question-lifecycle.repository.js';
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
    {
      provide: QUESTION_LIFECYCLE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): QuestionLifecycleRepository =>
        new PrismaQuestionLifecycleRepository(prisma),
    },
    {
      provide: QUESTION_ASSIGNMENT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): QuestionAssignmentRepository =>
        new PrismaQuestionAssignmentRepository(prisma),
    },
  ],
  exports: [
    QUESTION_VERSION_REPOSITORY,
    QUESTION_LIFECYCLE_REPOSITORY,
    QUESTION_ASSIGNMENT_REPOSITORY,
  ],
})
export class QuestionBankPersistenceModule {}
