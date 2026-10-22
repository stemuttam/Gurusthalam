-- Phase 5.12 authentication gap closure: Auth0 external identity mapping and
-- Gurusthalam-owned principal/tenant membership records.
-- Additive migration. Never amend previously applied migrations.

CREATE TYPE "AuthPrincipalStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "PrincipalTenantMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "AuthPrincipal" (
  "id" TEXT NOT NULL,
  "status" "AuthPrincipalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthPrincipal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIdentity" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "auth0OrganizationId" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrincipalTenantMembership" (
  "principalId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "learnerId" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "PrincipalTenantMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrincipalTenantMembership_pkey" PRIMARY KEY ("principalId", "tenantId")
);

CREATE UNIQUE INDEX "ExternalIdentity_provider_issuer_subject_key"
  ON "ExternalIdentity"("provider", "issuer", "subject");
CREATE INDEX "ExternalIdentity_principalId_idx"
  ON "ExternalIdentity"("principalId");
CREATE INDEX "AuthPrincipal_status_createdAt_idx"
  ON "AuthPrincipal"("status", "createdAt");
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_auth0OrganizationId_key" ON "Tenant"("auth0OrganizationId");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE UNIQUE INDEX "PrincipalTenantMembership_learnerId_key"
  ON "PrincipalTenantMembership"("learnerId");
CREATE INDEX "PrincipalTenantMembership_tenantId_status_idx"
  ON "PrincipalTenantMembership"("tenantId", "status");
CREATE INDEX "PrincipalTenantMembership_tenantId_learnerId_status_idx"
  ON "PrincipalTenantMembership"("tenantId", "learnerId", "status");

ALTER TABLE "ExternalIdentity"
  ADD CONSTRAINT "ExternalIdentity_principalId_fkey"
  FOREIGN KEY ("principalId") REFERENCES "AuthPrincipal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_principalId_fkey"
  FOREIGN KEY ("principalId") REFERENCES "AuthPrincipal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defensive database invariants for rows created outside the Prisma service.
ALTER TABLE "ExternalIdentity"
  ADD CONSTRAINT "ExternalIdentity_provider_issuer_subject_nonempty_check"
  CHECK (length(btrim("provider")) > 0 AND length(btrim("issuer")) > 0 AND length(btrim("subject")) > 0);

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_slug_name_nonempty_check"
  CHECK (length(btrim("slug")) > 0 AND length(btrim("name")) > 0);

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_platform_org_mapping_check"
  CHECK (("slug" = 'platform' AND "auth0OrganizationId" IS NULL) OR ("slug" <> 'platform' AND "auth0OrganizationId" IS NOT NULL));

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_learner_id_nonempty_check"
  CHECK ("learnerId" IS NULL OR length(btrim("learnerId")) > 0);

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_learner_role_requires_learner_id_check"
  CHECK (NOT ('learner' = ANY("roles")) OR "learnerId" IS NOT NULL);

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_timezone_nonempty_check"
  CHECK (length(btrim("timezone")) > 0);

ALTER TABLE "PrincipalTenantMembership"
  ADD CONSTRAINT "PrincipalTenantMembership_roles_nonempty_check"
  CHECK (array_position("roles", '') IS NULL AND array_position("roles", NULL::TEXT) IS NULL);
