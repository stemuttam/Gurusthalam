-- Phase 5.14-G-D
-- Tenant-scoped Question assignments and collaboration roles.
--
-- Existing Questions are intentionally not backfilled. Legacy Questions
-- without tenant ownership remain unassigned and cannot be modified through
-- the tenant-scoped lifecycle API.

CREATE TYPE "QuestionAssignmentRole" AS ENUM (
  'OWNER',
  'AUTHOR',
  'CO_AUTHOR',
  'EDITOR'
);

-- Required as the referenced key for the composite tenant-scoped FK.
CREATE UNIQUE INDEX "Question_id_tenantId_key"
  ON "Question" ("id", "tenantId");

CREATE TABLE "QuestionAssignment" (
  "questionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "role" "QuestionAssignmentRole" NOT NULL,
  "assignedByPrincipalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuestionAssignment_pkey"
    PRIMARY KEY ("questionId", "principalId"),

  CONSTRAINT "QuestionAssignment_question_tenant_fkey"
    FOREIGN KEY ("questionId", "tenantId")
    REFERENCES "Question" ("id", "tenantId")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT "QuestionAssignment_member_tenant_fkey"
    FOREIGN KEY ("principalId", "tenantId")
    REFERENCES "PrincipalTenantMembership" ("principalId", "tenantId")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT "QuestionAssignment_assigner_tenant_fkey"
    FOREIGN KEY ("assignedByPrincipalId", "tenantId")
    REFERENCES "PrincipalTenantMembership" ("principalId", "tenantId")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "QuestionAssignment_tenantId_principalId_role_idx"
  ON "QuestionAssignment" ("tenantId", "principalId", "role");

CREATE INDEX "QuestionAssignment_questionId_role_idx"
  ON "QuestionAssignment" ("questionId", "role");

CREATE INDEX "QuestionAssignment_assignedByPrincipalId_createdAt_idx"
  ON "QuestionAssignment" ("assignedByPrincipalId", "createdAt");

-- A Question can have at most one OWNER. This is deliberately a partial
-- unique index so legacy Questions without assignments remain unaffected.
CREATE UNIQUE INDEX "QuestionAssignment_one_owner_per_question"
  ON "QuestionAssignment" ("questionId")
  WHERE "role" = 'OWNER';