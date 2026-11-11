
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import {
  QuestionAssignmentApplicationService,
  QuestionAssignmentAuthenticationError,
  QuestionAssignmentValidationError,
  QuestionLifecycleApplicationService,
  QuestionLifecycleAuthenticationError,
  QuestionLifecycleNotFoundError,
  type GrantQuestionAssignmentCommand,
  type ChangeQuestionAssignmentRoleCommand,
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

interface AssignmentGrantBody {
  readonly principalId: string;
  readonly role: GrantQuestionAssignmentCommand['role'];
}

interface AssignmentRoleBody {
  readonly role: ChangeQuestionAssignmentRoleCommand['role'];
}

interface OwnershipTransferBody {
  readonly newOwnerPrincipalId: string;
}

@Controller('question-bank/questions')
export class QuestionBankController {
  constructor(
    private readonly application: QuestionLifecycleApplicationService,
    private readonly assignmentApplication: QuestionAssignmentApplicationService,
    private readonly principalResolver: RequestPrincipalResolver,
    private readonly authorization: QuestionBankAuthorizationService,
  ) {}

  @Post()
  async create(
    @Req() request: unknown,
    @Body() draft: QuestionVersionDraft,
  ) {
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

  /**
   * Grants AUTHOR, CO_AUTHOR, or EDITOR access to a Question.
   *
   * The actor is always derived from trusted request authentication context.
   * The repository performs the authoritative manager and membership checks
   * inside its transaction.
   */
  @Post(':questionId/assignments')
  async grantAssignment(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ) {
    const principal = this.requirePrincipal(request);
    const input = this.parseGrantBody(body);

    return this.execute(() =>
      this.assignmentApplication.grant(
        this.toActor(principal),
        questionId,
        input.principalId,
        input.role,
      ),
    );
  }

  /**
   * Changes an existing non-OWNER assignment role.
   */
  @Patch(':questionId/assignments/:principalId')
  async changeAssignmentRole(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Param('principalId') principalId: string,
    @Body() body: unknown,
  ) {
    const principal = this.requirePrincipal(request);
    const input = this.parseRoleBody(body);

    return this.execute(() =>
      this.assignmentApplication.changeRole(
        this.toActor(principal),
        questionId,
        principalId,
        input.role,
      ),
    );
  }

  /**
   * Revokes a non-OWNER assignment.
   */
  @Delete(':questionId/assignments/:principalId')
  async revokeAssignment(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Param('principalId') principalId: string,
  ): Promise<void> {
    const principal = this.requirePrincipal(request);

    await this.execute(() =>
      this.assignmentApplication.revoke(
        this.toActor(principal),
        questionId,
        principalId,
      ),
    );
  }

  /**
   * Lists the assignments for a Question.
   *
   * The repository enforces tenant isolation and manager authorization.
   */
  @Get(':questionId/assignments')
  async listAssignments(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
  ) {
    const principal = this.requirePrincipal(request);

    return this.execute(() =>
      this.assignmentApplication.list(
        this.toActor(principal),
        questionId,
      ),
    );
  }

  /**
   * Atomically transfers the OWNER assignment.
   *
   * The repository must lock the Question and perform the old-owner
   * demotion/new-owner promotion in one transaction.
   */
  @Post(':questionId/ownership/transfer')
  async transferOwnership(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ) {
    const principal = this.requirePrincipal(request);
    const input = this.parseOwnershipTransferBody(body);

    return this.execute(() =>
      this.assignmentApplication.transferOwnership(
        this.toActor(principal),
        questionId,
        input.newOwnerPrincipalId,
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

    return Object.freeze({
      principalId: principal.principalId,
      tenantId: principal.tenantId,
    });
  }

  private parseGrantBody(body: unknown): AssignmentGrantBody {
    const record = this.requireObjectBody(body);

    if (
      typeof record.principalId !== 'string' ||
      record.principalId.length === 0 ||
      record.principalId.trim() !== record.principalId
    ) {
      throw new BadRequestException(
        'principalId must be a non-empty canonical identifier.',
      );
    }

    if (typeof record.role !== 'string') {
      throw new BadRequestException('role must be a string.');
    }

    return {
      principalId: record.principalId,
      role: record.role as GrantQuestionAssignmentCommand['role'],
    };
  }

  private parseRoleBody(body: unknown): AssignmentRoleBody {
    const record = this.requireObjectBody(body);

    if (typeof record.role !== 'string') {
      throw new BadRequestException('role must be a string.');
    }

    return {
      role: record.role as ChangeQuestionAssignmentRoleCommand['role'],
    };
  }

  private parseOwnershipTransferBody(
    body: unknown,
  ): OwnershipTransferBody {
    const record = this.requireObjectBody(body);

    if (
      typeof record.newOwnerPrincipalId !== 'string' ||
      record.newOwnerPrincipalId.length === 0 ||
      record.newOwnerPrincipalId.trim() !==
        record.newOwnerPrincipalId
    ) {
      throw new BadRequestException(
        'newOwnerPrincipalId must be a non-empty canonical identifier.',
      );
    }

    return {
      newOwnerPrincipalId: record.newOwnerPrincipalId,
    };
  }

  private requireObjectBody(
    body: unknown,
  ): Record<string, unknown> {
    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      throw new BadRequestException(
        'A JSON object request body is required.',
      );
    }

    return body as Record<string, unknown>;
  }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof QuestionLifecycleAuthenticationError ||
        error instanceof QuestionAssignmentAuthenticationError
      ) {
        throw new UnauthorizedException(error.message);
      }

      if (error instanceof QuestionAssignmentValidationError) {
        throw new BadRequestException(error.message);
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
          case PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT:
          case PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT:
            throw new ConflictException(error.message);

          default:
            throw error;
        }
      }

      throw error;
    }
  }
}
