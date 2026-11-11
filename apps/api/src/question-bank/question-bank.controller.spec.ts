
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  QuestionAssignmentApplicationService,
  QuestionLifecycleApplicationService,
} from '@gurusthalam/question-bank';

import { createAuthenticatedPrincipal } from '../security/authorization/authenticated-principal.js';
import type { RequestPrincipalResolver } from '../security/authorization/request-principal.resolver.js';
import type { QuestionBankAuthorizationService } from '../security/authorization/question-bank-authorization.service.js';

import { QuestionBankController } from './question-bank.controller.js';

describe('QuestionBankController assignment API', () => {
  const principal = createAuthenticatedPrincipal('actor-1', {
    tenantId: 'tenant-1',
    roles: ['teacher'],
  });

  const request = {
    user: principal,
  };

  let lifecycle: {
    create: ReturnType<typeof vi.fn>;
    revise: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };

  let assignments: {
    grant: ReturnType<typeof vi.fn>;
    changeRole: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    transferOwnership: ReturnType<typeof vi.fn>;
  };

  let resolver: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let authorization: {
    assertAuthorized: ReturnType<typeof vi.fn>;
  };

  let controller: QuestionBankController;

  beforeEach(() => {
    lifecycle = {
      create: vi.fn().mockResolvedValue({
        questionId: 'question-1',
        versionId: 'version-1',
        versionNumber: 1,
      }),
      revise: vi.fn().mockResolvedValue({
        questionId: 'question-1',
        versionId: 'version-2',
        versionNumber: 2,
        previousVersionId: 'version-1',
      }),
      restore: vi.fn().mockResolvedValue({
        questionId: 'question-1',
        versionId: 'version-3',
        versionNumber: 3,
        previousVersionId: 'version-2',
        restoredFromVersionId: 'version-1',
      }),
    };

    assignments = {
      grant: vi.fn().mockResolvedValue({
        questionId: 'question-1',
        principalId: 'target-1',
        role: 'EDITOR',
      }),
      changeRole: vi.fn().mockResolvedValue({
        questionId: 'question-1',
        principalId: 'target-1',
        role: 'AUTHOR',
      }),
      revoke: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      transferOwnership: vi.fn().mockResolvedValue([]),
    };

    resolver = {
      resolve: vi.fn().mockReturnValue(principal),
    };

    authorization = {
      assertAuthorized: vi.fn(),
    };

    controller = new QuestionBankController(
      lifecycle as unknown as QuestionLifecycleApplicationService,
      assignments as unknown as QuestionAssignmentApplicationService,
      resolver as unknown as RequestPrincipalResolver,
      authorization as unknown as QuestionBankAuthorizationService,
    );
  });

  it('grants an assignment using the trusted actor and tenant', async () => {
    await controller.grantAssignment(
      request,
      'question-1',
      {
        principalId: 'target-1',
        role: 'EDITOR',
        actorPrincipalId: 'forged-actor',
        tenantId: 'forged-tenant',
      },
    );

    expect(assignments.grant).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      'question-1',
      'target-1',
      'EDITOR',
    );
  });

  it('changes an assignment role using the trusted actor', async () => {
    await controller.changeAssignmentRole(
      request,
      'question-1',
      'target-1',
      { role: 'AUTHOR' },
    );

    expect(assignments.changeRole).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      'question-1',
      'target-1',
      'AUTHOR',
    );
  });

  it('revokes an assignment using the trusted actor', async () => {
    await controller.revokeAssignment(
      request,
      'question-1',
      'target-1',
    );

    expect(assignments.revoke).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      'question-1',
      'target-1',
    );
  });

  it('lists assignments using the trusted actor', async () => {
    await controller.listAssignments(request, 'question-1');

    expect(assignments.list).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      'question-1',
    );
  });

  it('transfers ownership using the trusted actor', async () => {
    await controller.transferOwnership(
      request,
      'question-1',
      { newOwnerPrincipalId: 'target-2' },
    );

    expect(assignments.transferOwnership).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      'question-1',
      'target-2',
    );
  });

  it('rejects a missing authenticated principal', async () => {
    resolver.resolve.mockReturnValueOnce(null);

    await expect(
      controller.listAssignments(request, 'question-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(assignments.list).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant context', async () => {
    resolver.resolve.mockReturnValueOnce(
      createAuthenticatedPrincipal('actor-1'),
    );

    await expect(
      controller.listAssignments(request, 'question-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(assignments.list).not.toHaveBeenCalled();
  });

  it('rejects a non-object assignment body', async () => {
    await expect(
      controller.grantAssignment(
        request,
        'question-1',
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(assignments.grant).not.toHaveBeenCalled();
  });

  it('rejects a missing target principal identifier', async () => {
    await expect(
      controller.grantAssignment(
        request,
        'question-1',
        { role: 'EDITOR' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(assignments.grant).not.toHaveBeenCalled();
  });

  it('rejects a missing assignment role', async () => {
    await expect(
      controller.changeAssignmentRole(
        request,
        'question-1',
        'target-1',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(assignments.changeRole).not.toHaveBeenCalled();
  });

  it('preserves the existing create authorization boundary', async () => {
    const draft = {
      questionType: 'TRUE_FALSE',
    } as never;

    await controller.create(request, draft);

    expect(authorization.assertAuthorized).toHaveBeenCalledTimes(1);
    expect(lifecycle.create).toHaveBeenCalledWith(
      {
        principalId: 'actor-1',
        tenantId: 'tenant-1',
      },
      draft,
    );
  });
});
