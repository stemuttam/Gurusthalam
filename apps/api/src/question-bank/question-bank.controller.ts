import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  Param,
  Req,
} from '@nestjs/common';

import {
  QuestionLifecycleApplicationService,
  type QuestionVersionDraft,
} from '@gurusthalam/question-bank';

import { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';

@Controller('question-bank/questions')
export class QuestionBankController {
  constructor(
    private readonly application: QuestionLifecycleApplicationService,
    private readonly principalResolver: RequestPrincipalResolver,
  ) {}

  @Post()
  async create(@Req() request: unknown, @Body() draft: QuestionVersionDraft) {
    return this.application.create(this.actor(request), draft);
  }

  @Post(':questionId/versions')
  async revise(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() draft: QuestionVersionDraft,
  ) {
    return this.application.revise(this.actor(request), questionId, draft);
  }

  @Post(':questionId/restore/:versionId')
  async restore(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.application.restore(this.actor(request), questionId, versionId);
  }

  private actor(request: unknown) {
    const principal = this.principalResolver.resolve(request);
    if (principal === null || principal.tenantId === undefined) {
      throw new UnauthorizedException(
        'An authenticated principal with an active tenant context is required.',
      );
    }
    return {
      principalId: principal.principalId,
      tenantId: principal.tenantId,
    };
  }
}
