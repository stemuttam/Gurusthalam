
import { Module } from '@nestjs/common';

import {
  QuestionAssignmentApplicationService,
  QuestionLifecycleApplicationService,
  type QuestionAssignmentRepository,
  type QuestionLifecycleRepository,
} from '@gurusthalam/question-bank';

import { QuestionBankPersistenceModule } from '../database/prisma/repositories/question-bank/question-bank-persistence.module.js';

import {
  QUESTION_ASSIGNMENT_REPOSITORY,
  QUESTION_LIFECYCLE_REPOSITORY,
} from '../database/prisma/repositories/question-bank/question-bank-repository.tokens.js';

import { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';

import { QuestionBankAuthorizationPolicy } from '../security/authorization/question-bank-authorization.policy.js';

import { QuestionBankAuthorizationService } from '../security/authorization/question-bank-authorization.service.js';

import { QuestionBankController } from './question-bank.controller.js';

@Module({
  imports: [QuestionBankPersistenceModule],
  controllers: [QuestionBankController],
  providers: [
    RequestPrincipalResolver,
    QuestionBankAuthorizationPolicy,
    QuestionBankAuthorizationService,
    {
      provide: QuestionLifecycleApplicationService,
      inject: [QUESTION_LIFECYCLE_REPOSITORY],
      useFactory: (
        repository: QuestionLifecycleRepository,
      ): QuestionLifecycleApplicationService =>
        new QuestionLifecycleApplicationService(repository),
    },
    {
      provide: QuestionAssignmentApplicationService,
      inject: [QUESTION_ASSIGNMENT_REPOSITORY],
      useFactory: (
        repository: QuestionAssignmentRepository,
      ): QuestionAssignmentApplicationService =>
        new QuestionAssignmentApplicationService(repository),
    },
  ],
  exports: [
    QuestionLifecycleApplicationService,
    QuestionAssignmentApplicationService,
    QuestionBankAuthorizationPolicy,
    QuestionBankAuthorizationService,
  ],
})
export class QuestionBankApplicationModule {}
