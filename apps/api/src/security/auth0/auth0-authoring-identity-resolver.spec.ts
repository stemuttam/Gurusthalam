
import { describe, expect, it, vi } from 'vitest';

import { Auth0AuthoringIdentityResolver } from './auth0-authoring-identity-resolver.js';

interface FixtureTenant {
  readonly id: string;
  readonly slug: string;
  readonly auth0OrganizationId: string | null;
  status: string;
}

interface FixtureMembership {
  readonly tenantId: string;
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

function makeIdentity(
  roles: string[] = ['teacher'],
): FixtureIdentity {
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
          timezone: 'Asia/Kolkata',
          roles,
          status: 'ACTIVE',
          tenant,
        },
      ],
    },
  };
}

function createResolver(
  findUnique: ReturnType<typeof vi.fn>,
): Auth0AuthoringIdentityResolver {
  return new Auth0AuthoringIdentityResolver({
    externalIdentity: { findUnique },
  } as never);
}

const verifiedIdentity = {
  issuer: 'https://tenant.example.auth0.com/',
  subject: 'auth0|verified-subject',
};

describe('Auth0AuthoringIdentityResolver', () => {
  it('resolves a teacher without requiring a learnerId', async () => {
    const resolver = createResolver(
      vi.fn().mockResolvedValue(makeIdentity(['teacher'])),
    );

    const result = await resolver.resolve(verifiedIdentity);

    expect(result).toEqual({
      authenticated: true,
      principalId: 'principal-internal-001',
      tenantId: 'tenant-internal-001',
      roles: ['teacher'],
      timezone: 'Asia/Kolkata',
    });
  });

  it.each([
    'teacher',
    'question_bank_admin',
    'tenant_admin',
    'learner',
  ])('resolves an active tenant member with role %s', async (role) => {
    const resolver = createResolver(
      vi.fn().mockResolvedValue(makeIdentity([role])),
    );

    const result = await resolver.resolve(verifiedIdentity);

    expect(result?.roles).toEqual([role]);
    expect(result?.tenantId).toBe('tenant-internal-001');
  });

  it('uses the verified Auth0 organization to select the tenant', async () => {
    const record = makeIdentity(['teacher']);
    const membership = record.principal.memberships[0];

    if (membership === undefined) {
      throw new Error('Expected a tenant membership fixture.');
    }

    const organizationTenant: FixtureTenant = {
      id: 'tenant-internal-002',
      slug: 'school-alpha',
      auth0OrganizationId: 'org_verified_alpha',
      status: 'ACTIVE',
    };

    const organizationRecord: FixtureIdentity = {
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

    const resolver = createResolver(
      vi.fn().mockResolvedValue(organizationRecord),
    );

    const result = await resolver.resolve({
      ...verifiedIdentity,
      organizationId: 'org_verified_alpha',
    });

    expect(result?.tenantId).toBe('tenant-internal-002');
  });

  it('does not resolve a tenant when the verified organization does not match', async () => {
    const resolver = createResolver(
      vi.fn().mockResolvedValue(makeIdentity()),
    );

    await expect(
      resolver.resolve({
        ...verifiedIdentity,
        organizationId: 'org_unrecognized',
      }),
    ).resolves.toBeNull();
  });

  it('limits organization-less identities to the provisioned platform tenant', async () => {
    const record = makeIdentity();
    const membership = record.principal.memberships[0];

    if (membership === undefined) {
      throw new Error('Expected a tenant membership fixture.');
    }

    const nonPlatformTenant: FixtureTenant = {
      id: 'tenant-internal-002',
      slug: 'school-alpha',
      auth0OrganizationId: 'org_verified_alpha',
      status: 'ACTIVE',
    };

    const nonPlatformRecord: FixtureIdentity = {
      ...record,
      principal: {
        ...record.principal,
        memberships: [
          {
            ...membership,
            tenantId: nonPlatformTenant.id,
            tenant: nonPlatformTenant,
          },
        ],
      },
    };

    const resolver = createResolver(
      vi.fn().mockResolvedValue(nonPlatformRecord),
    );

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();
  });

  it('rejects unknown and inactive principals', async () => {
    const inactive = makeIdentity();
    const inactiveRecord: FixtureIdentity = {
      ...inactive,
      principal: {
        ...inactive.principal,
        status: 'SUSPENDED',
      },
    };

    const resolver = createResolver(
      vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(inactiveRecord),
    );

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();
  });

  it('rejects suspended tenants', async () => {
    const record = makeIdentity();
    const membership = record.principal.memberships[0];

    if (membership === undefined) {
      throw new Error('Expected a tenant membership fixture.');
    }

    membership.tenant.status = 'SUSPENDED';

    const resolver = createResolver(
      vi.fn().mockResolvedValue(record),
    );

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();
  });

  it('rejects malformed roles and invalid timezones', async () => {
    const malformedRoles = makeIdentity(['teacher ']);
    const invalidTimezone = makeIdentity(['teacher']);

    const timezoneMembership =
      invalidTimezone.principal.memberships[0];

    if (timezoneMembership === undefined) {
      throw new Error('Expected a tenant membership fixture.');
    }

    Object.defineProperty(timezoneMembership, 'timezone', {
      value: 'Not/A_Timezone',
      configurable: true,
    });

    const resolver = createResolver(
      vi.fn()
        .mockResolvedValueOnce(malformedRoles)
        .mockResolvedValueOnce(invalidTimezone),
    );

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();

    await expect(
      resolver.resolve(verifiedIdentity),
    ).resolves.toBeNull();
  });

  it('does not create or provision identities during resolution', async () => {
    const findUnique = vi.fn().mockResolvedValue(makeIdentity());
    const resolver = createResolver(findUnique);

    await resolver.resolve(verifiedIdentity);

    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
