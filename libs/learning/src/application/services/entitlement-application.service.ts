import {
  Entitlement,
  EntitlementDomainError,
  EntitlementDomainErrorCode,
  EntitlementValidationError,
  type EntitlementRepository,
} from '../../domain/entitlement/index.js';

import type { EnrollmentRepository } from '../../domain/enrollment/enrollment-repository.js';

import { evaluateEntitlementAccess } from '../policies/entitlement-access.policy.js';

import type {
  CheckEntitlementAccessInput,
  EntitlementApplicationService,
  ExpireEntitlementInput,
  GetEntitlementInput,
  GrantEntitlementInput,
  RestoreEntitlementInput,
  RevokeEntitlementInput,
  SuspendEntitlementInput,
} from '../contracts/entitlement-application.contracts.js';

import {
  checkEntitlementAccessInputSchema,
  expireEntitlementInputSchema,
  getEntitlementInputSchema,
  grantEntitlementInputSchema,
  restoreEntitlementInputSchema,
  revokeEntitlementInputSchema,
  suspendEntitlementInputSchema,
} from '../contracts/entitlement-application.validation.js';

export class DefaultEntitlementApplicationService implements EntitlementApplicationService {
  constructor(
    private readonly entitlementRepository: EntitlementRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async grantEntitlement(input: GrantEntitlementInput): Promise<Entitlement> {
    const parsed = grantEntitlementInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EntitlementValidationError(
        'Invalid Entitlement grant input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      throw new EntitlementDomainError(
        'Enrollment was not found.',
        EntitlementDomainErrorCode.ENROLLMENT_NOT_ELIGIBLE,
        [
          {
            field: 'enrollmentId',
            message: 'Enrollment was not found.',
          },
        ],
      );
    }

    if (enrollment.status === 'CANCELLED' || enrollment.status === 'EXPIRED') {
      throw new EntitlementDomainError(
        'Entitlement cannot be granted to a terminal enrollment.',
        EntitlementDomainErrorCode.ENROLLMENT_NOT_ELIGIBLE,
        [
          {
            field: 'enrollmentId',
            message: `Enrollment status ${enrollment.status} does not permit access.`,
          },
        ],
      );
    }

    const existing = await this.entitlementRepository.findActiveByEnrollmentId(
      enrollment.id,
    );

    if (existing !== null) {
      throw new EntitlementDomainError(
        'An active entitlement already exists for this enrollment.',
        EntitlementDomainErrorCode.DUPLICATE_ACTIVE,
        [
          {
            field: 'enrollmentId',
            message:
              'Only one active or suspended entitlement is allowed for an enrollment.',
          },
        ],
      );
    }

    const now = new Date();

    const entitlement = Entitlement.create({
      enrollmentId: enrollment.id,
      source: parsed.data.source,
      startsAt:
        parsed.data.startsAt === undefined
          ? enrollment.startsAt
          : new Date(parsed.data.startsAt),
      expiresAt:
        parsed.data.expiresAt === undefined
          ? enrollment.expiresAt
          : parsed.data.expiresAt === null
            ? null
            : new Date(parsed.data.expiresAt),
      now,
    });

    await this.entitlementRepository.save(entitlement);

    return entitlement;
  }

  async getEntitlement(
    input: GetEntitlementInput,
  ): Promise<Entitlement | null> {
    const parsed = getEntitlementInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EntitlementValidationError(
        'Invalid Entitlement query input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    return this.entitlementRepository.findById(parsed.data.entitlementId);
  }

  async suspendEntitlement(
    input: SuspendEntitlementInput,
  ): Promise<Entitlement> {
    const entitlement = await this.requireEntitlement(
      suspendEntitlementInputSchema,
      input,
      'suspend',
    );

    entitlement.suspend();

    await this.entitlementRepository.save(entitlement);

    return entitlement;
  }

  async restoreEntitlement(
    input: RestoreEntitlementInput,
  ): Promise<Entitlement> {
    const entitlement = await this.requireEntitlement(
      restoreEntitlementInputSchema,
      input,
      'restore',
    );

    entitlement.restore();

    await this.entitlementRepository.save(entitlement);

    return entitlement;
  }

  async revokeEntitlement(input: RevokeEntitlementInput): Promise<Entitlement> {
    const entitlement = await this.requireEntitlement(
      revokeEntitlementInputSchema,
      input,
      'revoke',
    );

    entitlement.revoke();

    await this.entitlementRepository.save(entitlement);

    return entitlement;
  }

  async expireEntitlement(input: ExpireEntitlementInput): Promise<Entitlement> {
    const entitlement = await this.requireEntitlement(
      expireEntitlementInputSchema,
      input,
      'expire',
    );

    entitlement.expire();

    await this.entitlementRepository.save(entitlement);

    return entitlement;
  }

  async checkAccess(input: CheckEntitlementAccessInput) {
    const parsed = checkEntitlementAccessInputSchema.safeParse(input);

    if (!parsed.success) {
      throw new EntitlementValidationError(
        'Invalid Entitlement access input.',
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const enrollment = await this.enrollmentRepository.findById(
      parsed.data.enrollmentId,
    );

    if (enrollment === null) {
      return {
        allowed: false,
        reason: 'ENROLLMENT_NOT_ACTIVE' as const,
        evaluatedAt: parsed.data.now ? new Date(parsed.data.now) : new Date(),
      };
    }

    const entitlement =
      await this.entitlementRepository.findActiveByEnrollmentId(enrollment.id);

    if (entitlement === null) {
      return {
        allowed: false,
        reason: 'ENTITLEMENT_NOT_ACTIVE' as const,
        evaluatedAt: parsed.data.now ? new Date(parsed.data.now) : new Date(),
      };
    }

    return evaluateEntitlementAccess({
      enrollmentStatus: enrollment.status,
      entitlementStatus: entitlement.status,
      startsAt: entitlement.startsAt,
      expiresAt: entitlement.expiresAt,
      now: parsed.data.now ? new Date(parsed.data.now) : new Date(),
    });
  }

  private async requireEntitlement<T extends { entitlementId: string }>(
    schema: {
      safeParse(input: unknown):
        | {
            success: true;
            data: T;
          }
        | {
            success: false;
            error: {
              issues: readonly {
                path: readonly PropertyKey[];
                message: string;
              }[];
            };
          };
    },
    input: unknown,
    operation: string,
  ): Promise<Entitlement> {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      throw new EntitlementValidationError(
        `Invalid Entitlement ${operation} input.`,
        parsed.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'input',
          message: issue.message,
        })),
        {
          cause: parsed.error,
        },
      );
    }

    const entitlement = await this.entitlementRepository.findById(
      parsed.data.entitlementId,
    );

    if (entitlement === null) {
      throw new EntitlementDomainError(
        'Entitlement was not found.',
        EntitlementDomainErrorCode.VALIDATION,
        [
          {
            field: 'entitlementId',
            message: 'Entitlement was not found.',
          },
        ],
      );
    }

    return entitlement;
  }
}
