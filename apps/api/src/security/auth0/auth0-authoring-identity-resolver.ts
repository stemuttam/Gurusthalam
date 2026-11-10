
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma/prisma.service.js';

import {
  createAuthenticatedPrincipal,
  isValidIanaTimeZone,
  type AuthenticatedPrincipal,
} from '../authorization/authenticated-principal.js';

import type { Auth0VerifiedIdentity } from './auth0-identity-resolver.js';

/**
 * Resolves a verified Auth0 identity to an active Gurusthalam tenant member.
 *
 * Unlike Auth0IdentityResolver, this resolver intentionally does not require
 * a learner role or learnerId. Question Bank authoring is available to
 * provisioned tenant members and is authorized separately by policy.
 *
 * Tenant selection is based exclusively on the verified Auth0 org_id claim.
 * An organization-less identity can resolve only to the explicitly provisioned
 * platform tenant.
 */
@Injectable()
export class Auth0AuthoringIdentityResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    identity: Auth0VerifiedIdentity,
  ): Promise<AuthenticatedPrincipal | null> {
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
          typeof role !== 'string' ||
          role.length === 0 ||
          role.trim() !== role,
      ) ||
      !isValidIanaTimeZone(membership.timezone)
    ) {
      return null;
    }

    return createAuthenticatedPrincipal(
      externalIdentity.principalId,
      {
        tenantId: membership.tenantId,
        roles: membership.roles,
        timezone: membership.timezone,
      },
    );
  }
}
