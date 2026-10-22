import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Required operator environment variable ${name} is missing.`,
    );
  }
  return value;
}

function normalizedIssuer(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('AUTH0_ISSUER_BASE_URL must be a valid HTTPS issuer URL.');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error(
      'AUTH0_ISSUER_BASE_URL must be an HTTPS origin without credentials, path, query, or fragment.',
    );
  }

  return `${parsed.origin}/`;
}

function parseRoles(value) {
  const roles = (value ?? 'learner')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  const uniqueRoles = [...new Set(roles)].sort();

  if (
    uniqueRoles.length === 0 ||
    uniqueRoles.some((role) => !/^[A-Za-z0-9:_-]{1,80}$/.test(role))
  ) {
    throw new Error(
      'GURUSTHALAM_ROLES must be a comma-separated list of valid role identifiers.',
    );
  }

  return uniqueRoles;
}

async function provision() {
  const issuer = normalizedIssuer(required('AUTH0_ISSUER_BASE_URL'));
  const subject = required('AUTH0_SUBJECT');
  const tenantSlug = required('AUTH0_TENANT_SLUG').toLowerCase();
  const tenantName = required('AUTH0_TENANT_NAME');
  const learnerId = required('GURUSTHALAM_LEARNER_ID');
  const timezone = process.env.GURUSTHALAM_TIMEZONE?.trim() || 'UTC';
  const auth0OrganizationId = process.env.AUTH0_ORGANIZATION_ID?.trim() || null;
  const requestedPrincipalId =
    process.env.GURUSTHALAM_PRINCIPAL_ID?.trim() || null;
  const roles = parseRoles(process.env.GURUSTHALAM_ROLES);
  const databaseUrl = required('DATABASE_URL');

  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(tenantSlug)) {
    throw new Error(
      'AUTH0_TENANT_SLUG must be a lowercase slug using letters, digits, and hyphens.',
    );
  }
  if (tenantSlug === 'platform' && auth0OrganizationId !== null) {
    throw new Error(
      'The platform tenant must not have an Auth0 organization ID.',
    );
  }
  if (tenantSlug !== 'platform' && auth0OrganizationId === null) {
    throw new Error(
      'Organization tenants require AUTH0_ORGANIZATION_ID; only the platform tenant may omit it.',
    );
  }
  if (subject.length > 255 || subject.trim() !== subject) {
    throw new Error('AUTH0_SUBJECT must be a valid, trimmed Auth0 sub value.');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error('GURUSTHALAM_TIMEZONE must be a valid IANA timezone.');
  }
  if (learnerId.length > 255 || learnerId.trim() !== learnerId) {
    throw new Error(
      'GURUSTHALAM_LEARNER_ID must be a valid, trimmed internal learner ID.',
    );
  }
  if (!roles.includes('learner')) {
    throw new Error(
      'This provisioning workflow creates learner memberships; GURUSTHALAM_ROLES must include learner.',
    );
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let tenantResult;
    if (auth0OrganizationId !== null) {
      tenantResult = await client.query(
        'SELECT "id", "slug", "name", "auth0OrganizationId", "status" FROM "Tenant" WHERE "slug" = $1 OR "auth0OrganizationId" = $2 FOR UPDATE',
        [tenantSlug, auth0OrganizationId],
      );
    } else {
      tenantResult = await client.query(
        'SELECT "id", "slug", "name", "auth0OrganizationId", "status" FROM "Tenant" WHERE "slug" = $1 FOR UPDATE',
        [tenantSlug],
      );
    }

    let tenant;
    if (tenantResult.rowCount > 0) {
      const exact = tenantResult.rows.find(
        (row) =>
          row.slug === tenantSlug &&
          row.auth0OrganizationId === auth0OrganizationId,
      );
      if (
        !exact ||
        tenantResult.rows.some(
          (row) =>
            row.slug !== tenantSlug ||
            row.auth0OrganizationId !== auth0OrganizationId,
        )
      ) {
        throw new Error(
          'A tenant slug or Auth0 organization ID is already mapped to a different tenant. Refusing to remap it.',
        );
      }
      if (exact.name !== tenantName) {
        throw new Error(
          'The tenant already exists with a different display name. Rename it through the approved administrative workflow first.',
        );
      }
      if (exact.status !== 'ACTIVE') {
        throw new Error(
          'The mapped tenant is suspended. Reactivate it through the approved administrative workflow first.',
        );
      }
      tenant = exact;
    } else {
      tenant = {
        id: randomUUID(),
        slug: tenantSlug,
        name: tenantName,
        auth0OrganizationId,
        status: 'ACTIVE',
      };
      await client.query(
        'INSERT INTO "Tenant" ("id", "slug", "name", "auth0OrganizationId", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [
          tenant.id,
          tenant.slug,
          tenant.name,
          tenant.auth0OrganizationId,
          tenant.status,
        ],
      );
    }

    const existingIdentity = await client.query(
      'SELECT e."principalId", p."status" AS "principalStatus" FROM "ExternalIdentity" e JOIN "AuthPrincipal" p ON p."id" = e."principalId" WHERE e."provider" = $1 AND e."issuer" = $2 AND e."subject" = $3 FOR UPDATE OF e, p',
      ['auth0', issuer, subject],
    );

    let principalId;
    if (existingIdentity.rowCount > 0) {
      principalId = existingIdentity.rows[0].principalId;
      if (
        requestedPrincipalId !== null &&
        requestedPrincipalId !== principalId
      ) {
        throw new Error(
          'This Auth0 identity is already linked to a different internal principal. Refusing to remap it.',
        );
      }
      if (existingIdentity.rows[0].principalStatus !== 'ACTIVE') {
        throw new Error(
          'The linked principal is suspended. Reactivate it through the approved administrative workflow first.',
        );
      }
    } else {
      principalId = requestedPrincipalId ?? randomUUID();
      const existingPrincipal = await client.query(
        'SELECT "id", "status" FROM "AuthPrincipal" WHERE "id" = $1 FOR UPDATE',
        [principalId],
      );
      if (existingPrincipal.rowCount === 0) {
        await client.query(
          'INSERT INTO "AuthPrincipal" ("id", "status", "createdAt", "updatedAt") VALUES ($1, \'ACTIVE\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [principalId],
        );
      } else if (existingPrincipal.rows[0].status !== 'ACTIVE') {
        throw new Error(
          'The requested internal principal is suspended. Refusing to attach an external identity.',
        );
      }
      await client.query(
        'INSERT INTO "ExternalIdentity" ("id", "provider", "issuer", "subject", "principalId", "createdAt") VALUES ($1, \'auth0\', $2, $3, $4, CURRENT_TIMESTAMP)',
        [randomUUID(), issuer, subject, principalId],
      );
    }

    const existingMembership = await client.query(
      'SELECT "learnerId", "timezone", "roles", "status" FROM "PrincipalTenantMembership" WHERE "principalId" = $1 AND "tenantId" = $2 FOR UPDATE',
      [principalId, tenant.id],
    );

    if (existingMembership.rowCount > 0) {
      const current = existingMembership.rows[0];
      const currentRoles = [...current.roles].sort();
      if (
        current.status !== 'ACTIVE' ||
        current.learnerId !== learnerId ||
        current.timezone !== timezone ||
        JSON.stringify(currentRoles) !== JSON.stringify(roles)
      ) {
        throw new Error(
          'An existing tenant membership differs from the requested learner ID, roles, or status. Refusing to change it implicitly.',
        );
      }

      await client.query('COMMIT');
      process.stdout.write(
        'Identity is already provisioned with the requested active mapping. No changes made.\n',
      );
      return;
    }

    await client.query(
      'INSERT INTO "PrincipalTenantMembership" ("principalId", "tenantId", "learnerId", "timezone", "roles", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::text[], \'ACTIVE\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [principalId, tenant.id, learnerId, timezone, roles],
    );

    await client.query('COMMIT');
    process.stdout.write(
      'Provisioned Auth0 external identity, internal principal link, tenant, and learner membership.\n',
    );
    process.stdout.write(`Internal principal ID: ${principalId}\n`);
    process.stdout.write(`Internal tenant slug: ${tenant.slug}\n`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

provision().catch((error) => {
  const message =
    error instanceof Error ? error.message : 'Unknown provisioning failure.';
  process.stderr.write(`Auth0 identity provisioning failed: ${message}\n`);
  process.exitCode = 1;
});
