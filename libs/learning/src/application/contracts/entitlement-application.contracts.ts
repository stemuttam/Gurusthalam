import type { Entitlement } from '../../domain/entitlement/entitlement.js';

export interface GrantEntitlementInput {
  readonly enrollmentId: string;
  readonly source: 'DIRECT' | 'COHORT' | 'ORGANIZATION' | 'SUBSCRIPTION';
  readonly startsAt?: string;
  readonly expiresAt?: string | null;
}

export interface GetEntitlementInput {
  readonly entitlementId: string;
}

export interface SuspendEntitlementInput {
  readonly entitlementId: string;
}

export interface RestoreEntitlementInput {
  readonly entitlementId: string;
}

export interface RevokeEntitlementInput {
  readonly entitlementId: string;
}

export interface ExpireEntitlementInput {
  readonly entitlementId: string;
}

export interface CheckEntitlementAccessInput {
  readonly enrollmentId: string;
  readonly now?: string;
}

export interface EnrollmentAccessSnapshot {
  readonly enrollmentId: string;
  readonly learnerId: string;
  readonly courseId: string;
  readonly courseVersionId: string;
  readonly enrollmentStatus:
    'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  readonly entitlement: Entitlement | null;
}

export interface EntitlementApplicationService {
  grantEntitlement(input: GrantEntitlementInput): Promise<Entitlement>;

  getEntitlement(input: GetEntitlementInput): Promise<Entitlement | null>;

  suspendEntitlement(input: SuspendEntitlementInput): Promise<Entitlement>;

  restoreEntitlement(input: RestoreEntitlementInput): Promise<Entitlement>;

  revokeEntitlement(input: RevokeEntitlementInput): Promise<Entitlement>;

  expireEntitlement(input: ExpireEntitlementInput): Promise<Entitlement>;

  checkAccess(input: CheckEntitlementAccessInput): Promise<{
    readonly allowed: boolean;
    readonly reason:
      | 'ALLOWED'
      | 'ENROLLMENT_NOT_ACTIVE'
      | 'ENTITLEMENT_NOT_ACTIVE'
      | 'ACCESS_NOT_STARTED'
      | 'ACCESS_EXPIRED';
    readonly evaluatedAt: Date;
  }>;
}
