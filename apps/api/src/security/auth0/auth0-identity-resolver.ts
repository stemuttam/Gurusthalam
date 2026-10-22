import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma/prisma.service.js';

import {
  createAuthenticatedLearnerPrincipal,
  type AuthenticatedLearnerPrincipal,
} from '../authorization/authenticated-learner-principal.js';
import { isValidIanaTimeZone } from '../authorization/authenticated-principal.js';

export interface Auth0VerifiedIdentity {
  /** Issuer has already been validated by the Auth0 JWT middleware. */
  readonly issuer: string;
  /** Auth0 sub claim from the verified access token. */
  readonly subject: string;
  /** Optional Auth0 org_id claim from the verified access token. */
  readonly organizationId?: string;
}

/**
 * Maps a verified Auth0 account to a Gurusthalam-owned principal and learner.
 * No row is created during authentication: provisioning is an explicit
 * operator-owned workflow, and unknown identities fail closed.
 */
@Injectable()
export class Auth0IdentityResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    identity: Auth0VerifiedIdentity,
  ): Promise<AuthenticatedLearnerPrincipal | null> {
    const externalIdentity = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_issuer_subject: {
          provider: 'auth0',
          issuer: identity.issuer,
          subject: identity.subject,
        },
      },
      include: {
        principal: {
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { tenant: true },
            },
          },
        },
      },
    });

    if (
      externalIdentity === null ||
      externalIdentity.principal.status !== 'ACTIVE'
    ) {
      return null;
    }

    const membership = externalIdentity.principal.memberships.find(
      (candidate) => {
        if (candidate.tenant.status !== 'ACTIVE') {
          return false;
        }

        if (identity.organizationId !== undefined) {
          return (
            candidate.tenant.auth0OrganizationId === identity.organizationId
          );
        }

        // An organization-less token is limited to an explicitly provisioned
        // platform membership. It cannot select an organization by request input.
        return (
          candidate.tenant.slug === 'platform' &&
          candidate.tenant.auth0OrganizationId === null
        );
      },
    );

    if (
      membership === undefined ||
      !Array.isArray(membership.roles) ||
      membership.roles.some(
        (role) =>
          typeof role !== 'string' || role.length === 0 || role.trim() !== role,
      ) ||
      !membership.roles.includes('learner') ||
      typeof membership.learnerId !== 'string' ||
      membership.learnerId.length === 0 ||
      membership.learnerId.trim() !== membership.learnerId ||
      !isValidIanaTimeZone(membership.timezone)
    ) {
      return null;
    }

    return createAuthenticatedLearnerPrincipal(
      externalIdentity.principalId,
      membership.learnerId,
      {
        tenantId: membership.tenantId,
        roles: membership.roles,
        timezone: membership.timezone,
      },
    );
  }
}
