-- Phase 5.2 — Enrollment Access / Entitlement
--
-- Production-safety properties:
--   * additive only
--   * no existing Enrollment rows modified
--   * no existing migration modified
--   * historical Enrollment records remain untouched
--   * Entitlement references Enrollment with ON DELETE RESTRICT
--   * one ACTIVE/SUSPENDED entitlement per Enrollment
--
-- The migration is intentionally explicit. Do not replace this with
-- IF NOT EXISTS guards because migration history itself is authoritative.

CREATE TYPE "EntitlementStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED'
);

CREATE TYPE "EntitlementSource" AS ENUM (
  'DIRECT',
  'COHORT',
  'ORGANIZATION',
  'SUBSCRIPTION'
);

CREATE TABLE "Entitlement" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "EntitlementSource" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Entitlement_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX "Entitlement_enrollmentId_status_createdAt_idx"
ON "Entitlement" ("enrollmentId", "status", "createdAt");

CREATE INDEX "Entitlement_status_expiresAt_idx"
ON "Entitlement" ("status", "expiresAt");

CREATE INDEX "Entitlement_source_status_idx"
ON "Entitlement" ("source", "status");

CREATE UNIQUE INDEX "Entitlement_active_enrollment_unique"
ON "Entitlement" ("enrollmentId")
WHERE "status" IN ('ACTIVE', 'SUSPENDED');

ALTER TABLE "Entitlement"
ADD CONSTRAINT "Entitlement_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId")
REFERENCES "Enrollment"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;