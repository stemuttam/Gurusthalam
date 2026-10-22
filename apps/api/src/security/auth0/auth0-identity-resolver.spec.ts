import { describe, expect, it, vi } from 'vitest';

import { Auth0IdentityResolver } from './auth0-identity-resolver.js';

interface FixtureTenant {
  readonly id: string;
  readonly slug: string;
  readonly auth0OrganizationId: string | null;
  status: string;
}

interface FixtureMembership {
  readonly tenantId: string;
  learnerId: string | null;
  readonly timezone: string;
  readonly roles: string[];
  readonly status: string;
  readonly tenant: FixtureTenant;
}

interface FixtureIdentity {
  readonly principalId: string;
  readonly principal: {
    readonly id: string;
    readonly status: string;
    readonly memberships: FixtureMembership[];
  };
}

function makeIdentity(): FixtureIdentity {
  const tenant: FixtureTenant = {
    id: 'tenant-internal-001',
    slug: 'platform',
    auth0OrganizationId: null,
    status: 'ACTIVE',
  };

  return {
    principalId: 'principal-internal-001',
    principal: {
      id: 'principal-internal-001',
      status: 'ACTIVE',
      memberships: [
        {
          tenantId: tenant.id,
          learnerId: 'learner-internal-001',
          timezone: 'Asia/Kolkata',
          roles: ['learner'],
          status: 'ACTIVE',
          tenant,
        },
      ],
    },
  };
}

function createResolver(
  findUnique: ReturnType<typeof vi.fn>,
): Auth0IdentityResolver {
  return new Auth0IdentityResolver({
    externalIdentity: { findUnique },
  } as never);
}

describe('Auth0IdentityResolver', () => {
  it('maps an Auth0 subject to an internal principal and platform learner membership', async () => {
    const findUnique = vi.fn().mockResolvedValue(makeIdentity());
    const resolver = createResolver(findUnique);

    const result = await resolver.resolve({
      issuer: 'https://tenant.example.auth0.com/',
      subject: 'auth0|verified-subject',
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        provider_issuer_subject: {
          provider: 'auth0',
          issuer: 'https://tenant.example.auth0.com/',
          subject: 'auth0|verified-subject',
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

    expect(result).toEqual({
      authenticated: true,
      principalId: 'principal-internal-001',
      learnerId: 'learner-internal-001',
      tenantId: 'tenant-internal-001',
      roles: ['learner'],
      timezone: 'Asia/Kolkata',
    });
    expect(result?.principalId).not.toBe('auth0|verified-subject');
  });

  it('resolves only the tenant matching a verified Auth0 organization claim', async () => {
    const record = makeIdentity();
    const membership = record.principal.memberships[0];

    if (membership === undefined) {
      throw new Error('Expected the fixture to contain a tenant membership.');
    }
    const organizationTenant: FixtureTenant = {
      id: 'tenant-internal-002',
      slug: 'school-alpha',
      auth0OrganizationId: 'org_verified_alpha',
      status: 'ACTIVE',
    };
    const orgRecord: FixtureIdentity = {
      ...record,
      principal: {
        ...record.principal,
        memberships: [
          {
            ...membership,
            tenantId: organizationTenant.id,
            tenant: organizationTenant,
          },
        ],
      },
    };
    const resolver = createResolver(vi.fn().mockResolvedValue(orgRecord));

    const result = await resolver.resolve({
      issuer: 'https://tenant.example.auth0.com/',
      subject: 'auth0|verified-subject',
      organizationId: 'org_verified_alpha',
    });

    expect(result?.tenantId).toBe('tenant-internal-002');
  });

  it('fails closed when the token organization does not match a provisioned tenant', async () => {
    const resolver = createResolver(vi.fn().mockResolvedValue(makeIdentity()));

    await expect(
      resolver.resolve({
        issuer: 'https://tenant.example.auth0.com/',
        subject: 'auth0|verified-subject',
        organizationId: 'org_unrecognized',
      }),
    ).resolves.toBeNull();
  });

  it('fails closed for unknown or suspended principals', async () => {
    const suspended = makeIdentity();
    const suspendedIdentity: FixtureIdentity = {
      ...suspended,
      principal: {
        ...suspended.principal,
        status: 'SUSPENDED',
        memberships: [],
      },
    };
    const resolver = createResolver(
      vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(suspendedIdentity),
    );

    await expect(
      resolver.resolve({
        issuer: 'https://tenant.example.auth0.com/',
        subject: 'missing',
      }),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve({
        issuer: 'https://tenant.example.auth0.com/',
        subject: 'suspended',
      }),
    ).resolves.toBeNull();
  });

  it('fails closed for suspended tenants or memberships without a learner role', async () => {
    const suspendedTenant = makeIdentity();
    const suspendedTenantMembership = suspendedTenant.principal.memberships[0];

    if (suspendedTenantMembership === undefined) {
      throw new Error(
        'Expected the suspended-tenant fixture to contain a membership.',
      );
    }

    suspendedTenantMembership.tenant.status = 'SUSPENDED';

    const nonLearner = makeIdentity();
    const nonLearnerMembership = nonLearner.principal.memberships[0];

    if (nonLearnerMembership === undefined) {
      throw new Error(
        'Expected the non-learner fixture to contain a membership.',
      );
    }

    nonLearnerMembership.roles.splice(0, 1, 'teacher');

    const resolver = createResolver(
      vi
        .fn()
        .mockResolvedValueOnce(suspendedTenant)
        .mockResolvedValueOnce(nonLearner),
    );

    await expect(
      resolver.resolve({
        issuer: 'https://tenant.example.auth0.com/',
        subject: 'one',
      }),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve({
        issuer: 'https://tenant.example.auth0.com/',
        subject: 'two',
      }),
    ).resolves.toBeNull();
  });
});
