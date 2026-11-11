import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import {
  QuestionAssignmentApplicationService,
  QuestionAssignmentRole,
  QuestionLifecycleApplicationService,
  type QuestionVersionDraft,
} from '@gurusthalam/question-bank';

import { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';
import { QuestionBankAuthorizationService } from '../security/authorization/question-bank-authorization.service.js';
import { QuestionBankAuthorizationOperation } from '../security/authorization/question-bank-authorization.types.js';
import type { AuthenticatedPrincipal } from '../security/authorization/authenticated-principal.js';

import { mapQuestionBankError } from './question-bank-error.mapper.js';

type NonOwnerAssignmentRole = Exclude<
  (typeof QuestionAssignmentRole)[keyof typeof QuestionAssignmentRole],
  'OWNER'
>;

interface AssignmentGrantBody {
  readonly principalId: string;
  readonly role: NonOwnerAssignmentRole;
}

interface AssignmentRoleBody {
  readonly role: NonOwnerAssignmentRole;
}

interface OwnershipTransferBody {
  readonly newOwnerPrincipalId: string;
}

const NON_OWNER_ASSIGNMENT_ROLES: ReadonlySet<string> = new Set([
  QuestionAssignmentRole.AUTHOR,
  QuestionAssignmentRole.CO_AUTHOR,
  QuestionAssignmentRole.EDITOR,
]);

@Controller('question-bank/questions')
export class QuestionBankController {
  constructor(
    private readonly application: QuestionLifecycleApplicationService,
    private readonly assignmentApplication: QuestionAssignmentApplicationService,
    private readonly principalResolver: RequestPrincipalResolver,
    private readonly authorization: QuestionBankAuthorizationService,
  ) {}

  @Post()
  async create(@Req() request: unknown, @Body() draft: QuestionVersionDraft) {
    const principal = this.requirePrincipal(request);
    const validatedDraft = this.requireQuestionVersionDraft(draft);

    this.authorization.assertAuthorized(
      principal,
      QuestionBankAuthorizationOperation.CREATE_QUESTION,
    );

    return this.execute(() =>
      this.application.create(this.toActor(principal), validatedDraft),
    );
  }

  @Post(':questionId/versions')
  async revise(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() draft: QuestionVersionDraft,
  ) {
    const principal = this.requirePrincipal(request);

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const validatedDraft = this.requireQuestionVersionDraft(draft);

    return this.execute(() =>
      this.application.revise(
        this.toActor(principal),
        validatedQuestionId,
        validatedDraft,
      ),
    );
  }

  @Post(':questionId/restore/:versionId')
  async restore(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Param('versionId') versionId: string,
  ) {
    const principal = this.requirePrincipal(request);

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const validatedVersionId = this.requireIdentifier(versionId, 'versionId');

    return this.execute(() =>
      this.application.restore(
        this.toActor(principal),
        validatedQuestionId,
        validatedVersionId,
      ),
    );
  }

  /**
   * Grants AUTHOR, CO_AUTHOR, or EDITOR access to a Question.
   *
   * The actor is always derived from trusted request authentication context.
   * The repository performs authoritative manager and membership checks
   * inside its transaction.
   */
  @Post(':questionId/assignments')
  async grantAssignment(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ) {
    const principal = this.requirePrincipal(request);

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const input = this.parseGrantBody(body);

    return this.execute(() =>
      this.assignmentApplication.grant(
        this.toActor(principal),
        validatedQuestionId,
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

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const validatedPrincipalId = this.requireIdentifier(
      principalId,
      'principalId',
    );

    const input = this.parseRoleBody(body);

    return this.execute(() =>
      this.assignmentApplication.changeRole(
        this.toActor(principal),
        validatedQuestionId,
        validatedPrincipalId,
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

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const validatedPrincipalId = this.requireIdentifier(
      principalId,
      'principalId',
    );

    await this.execute(() =>
      this.assignmentApplication.revoke(
        this.toActor(principal),
        validatedQuestionId,
        validatedPrincipalId,
      ),
    );
  }

  /**
   * Lists assignments for a Question.
   *
   * The repository enforces tenant isolation and manager authorization.
   */
  @Get(':questionId/assignments')
  async listAssignments(
    @Req() request: unknown,
    @Param('questionId') questionId: string,
  ) {
    const principal = this.requirePrincipal(request);

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    return this.execute(() =>
      this.assignmentApplication.list(
        this.toActor(principal),
        validatedQuestionId,
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

    const validatedQuestionId = this.requireIdentifier(
      questionId,
      'questionId',
    );

    const input = this.parseOwnershipTransferBody(body);

    return this.execute(() =>
      this.assignmentApplication.transferOwnership(
        this.toActor(principal),
        validatedQuestionId,
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

  /**
   * Validates identifiers without imposing a UUID-only constraint.
   *
   * The domain currently defines canonical identifiers as non-empty strings
   * with no leading or trailing whitespace. Preserve that contract here.
   */
  private requireIdentifier(value: unknown, field: string): string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.trim() !== value
    ) {
      throw new BadRequestException(
        `${field} must be a non-empty canonical identifier.`,
      );
    }

    return value;
  }

  private parseGrantBody(body: unknown): AssignmentGrantBody {
    const record = this.requireObjectBody(body);

    const principalId = this.requireIdentifier(
      record.principalId,
      'principalId',
    );

    const role = this.parseNonOwnerAssignmentRole(record.role);

    return {
      principalId,
      role,
    };
  }

  private parseRoleBody(body: unknown): AssignmentRoleBody {
    const record = this.requireObjectBody(body);

    return {
      role: this.parseNonOwnerAssignmentRole(record.role),
    };
  }

  private parseNonOwnerAssignmentRole(value: unknown): NonOwnerAssignmentRole {
    if (typeof value !== 'string') {
      throw new BadRequestException('role must be a valid assignment role.');
    }

    if (value === QuestionAssignmentRole.OWNER) {
      throw new BadRequestException(
        'The OWNER role can only be established through ownership transfer.',
      );
    }

    if (!NON_OWNER_ASSIGNMENT_ROLES.has(value)) {
      throw new BadRequestException(
        'role must be one of AUTHOR, CO_AUTHOR, or EDITOR.',
      );
    }

    return value as NonOwnerAssignmentRole;
  }

  private parseOwnershipTransferBody(body: unknown): OwnershipTransferBody {
    const record = this.requireObjectBody(body);

    return {
      newOwnerPrincipalId: this.requireIdentifier(
        record.newOwnerPrincipalId,
        'newOwnerPrincipalId',
      ),
    };
  }

  /**
   * Validates that a request body is a plain JSON object.
   *
   * Arrays, null, primitives, and non-plain objects are rejected.
   * Unknown properties are intentionally ignored by individual parsers.
   */
  private requireObjectBody(body: unknown): Record<string, unknown> {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('A JSON object request body is required.');
    }

    const prototype = Object.getPrototypeOf(body);

    if (prototype !== Object.prototype && prototype !== null) {
      throw new BadRequestException(
        'A plain JSON object request body is required.',
      );
    }

    return body as Record<string, unknown>;
  }

  /**
   * The current version-draft contract is validated as a plain object here.
   * Question-type-specific content validation remains in the domain and
   * application layers; this boundary does not duplicate that logic.
   */
  private requireQuestionVersionDraft(draft: unknown): QuestionVersionDraft {
    this.requireObjectBody(draft);

    return draft as QuestionVersionDraft;
  }

  /**
   * Centralized A4-D error mapping.
   *
   * Known Question Bank application and repository errors are converted
   * into stable public HTTP errors. Unknown errors are rethrown unchanged
   * so the global exception filter can handle them safely.
   */
  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const mappedError = mapQuestionBankError(error);

      if (mappedError !== null) {
        throw mappedError;
      }

      throw error;
    }
  }
}
