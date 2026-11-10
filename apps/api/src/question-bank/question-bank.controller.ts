import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import {
  QuestionLifecycleApplicationService,
  QuestionLifecycleAuthenticationError,
  QuestionLifecycleNotFoundError,
  type QuestionVersionDraft,
} from '@gurusthalam/question-bank';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../database/prisma/repositories/prisma-repository.error.js';

import { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';
import { QuestionBankAuthorizationService } from '../security/authorization/question-bank-authorization.service.js';
import { QuestionBankAuthorizationOperation } from '../security/authorization/question-bank-authorization.types.js';
import type { AuthenticatedPrincipal } from '../security/authorization/authenticated-principal.js';

@Controller('question-bank/questions')
export class QuestionBankController {
  constructor(
    private readonly application: QuestionLifecycleApplicationService,
    private readonly principalResolver: RequestPrincipalResolver,
    private readonly authorization: QuestionBankAuthorizationService,
  ) {}

  @Post()
  async create(@Req() request: unknown, @Body() draft: QuestionVersionDraft) {
    const principal = this.requirePrincipal(request);
    this.authorization.assertAuthorized(
      principal,
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    return this.execute(() =>
      this.application.create(this.toActor(principal), draft),
    );
  }

  @Post(':questionId/versions')
  async revise(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() draft: QuestionVersionDraft,
  ) {
    const principal = this.requirePrincipal(request);

    return this.execute(() =>
      this.application.revise(this.toActor(principal), questionId, draft),
    );
  }

  @Post(':questionId/restore/:versionId')
  async restore(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Param('versionId') versionId: string,
  ) {
    const principal = this.requirePrincipal(request);

    return this.execute(() =>
      this.application.restore(
        this.toActor(principal),
        questionId,
        versionId,
      ),
    );
  }

  private requirePrincipal(request: unknown): AuthenticatedPrincipal {
    const principal = this.principalResolver.resolve(request);

    if (principal === null || principal.tenantId === undefined) {
      throw new UnauthorizedException(
        'An authenticated principal with an active tenant context is required.',
      );
    }

    return principal;
  }

  private toActor(principal: AuthenticatedPrincipal) {
    if (principal.tenantId === undefined) {
      throw new UnauthorizedException(
        'An authenticated tenant context is required.',
      );
    }

    return {
      principalId: principal.principalId,
      tenantId: principal.tenantId,
    };
  }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof QuestionLifecycleAuthenticationError) {
        throw new UnauthorizedException(error.message);
      }

      if (error instanceof QuestionLifecycleNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof PrismaRepositoryError) {
        switch (error.code) {
          case PrismaRepositoryErrorCode.AUTHORIZATION_DENIED:
            throw new ForbiddenException(error.message);
          case PrismaRepositoryErrorCode.RECORD_NOT_FOUND:
            throw new NotFoundException(error.message);
          case PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION:
            throw new ConflictException(error.message);
          default:
            throw error;
        }
      }

      throw error;
    }
  }
}
