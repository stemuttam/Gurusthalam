
-- Phase 5.14-F-B
-- Tenant-scoped Question ownership.
--
-- Legacy preservation policy:
--   Existing Question rows are retained.
--   Existing rows receive NULL ownership values.
--   Ownership is never inferred or backfilled by this migration.
--
-- New application writes must provide both ownership columns and must
-- validate active principal/tenant membership inside their transaction.

ALTER TABLE "Question"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "createdByPrincipalId" TEXT;

-- Ownership is either wholly unassigned (legacy) or wholly assigned.
ALTER TABLE "Question"
  ADD CONSTRAINT "Question_ownership_pair_check"
  CHECK (
    (
      "tenantId" IS NULL
      AND "createdByPrincipalId" IS NULL
    )
    OR
    (
      "tenantId" IS NOT NULL
      AND "createdByPrincipalId" IS NOT NULL
    )
  );

-- Enforce that the recorded owner is a real principal/tenant membership.
-- Membership status is checked transactionally by the application because
-- a foreign key cannot enforce that the referenced membership is ACTIVE.
ALTER TABLE "Question"
  ADD CONSTRAINT "Question_owner_membership_fkey"
  FOREIGN KEY ("createdByPrincipalId", "tenantId")
  REFERENCES "PrincipalTenantMembership" ("principalId", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Supports tenant-scoped Question listing and lookup.
CREATE INDEX "Question_tenantId_createdAt_idx"
  ON "Question" ("tenantId", "createdAt");

-- Supports tenant-scoped identity lookup.
CREATE INDEX "Question_tenantId_id_idx"
  ON "Question" ("tenantId", "id");
