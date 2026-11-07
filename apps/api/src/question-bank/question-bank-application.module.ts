
import { Module } from '@nestjs/common';

import {
  QuestionLifecycleApplicationService,
  type QuestionLifecycleRepository,
} from '@gurusthalam/question-bank';

import { QuestionBankPersistenceModule } from '../database/prisma/repositories/question-bank/question-bank-persistence.module.js';

import { QUESTION_LIFECYCLE_REPOSITORY } from '../database/prisma/repositories/question-bank/question-bank-repository.tokens.js';

import { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';

import { QuestionBankController } from './question-bank.controller.js';

@Module({
  imports: [QuestionBankPersistenceModule],
  controllers: [QuestionBankController],
  providers: [
    RequestPrincipalResolver,
    {
      provide: QuestionLifecycleApplicationService,
      inject: [QUESTION_LIFECYCLE_REPOSITORY],
      useFactory: (
        repository: QuestionLifecycleRepository,
      ): QuestionLifecycleApplicationService =>
        new QuestionLifecycleApplicationService(repository),
    },
  ],
  exports: [QuestionLifecycleApplicationService],
})
export class QuestionBankApplicationModule {}
