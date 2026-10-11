-- =============================================================
-- Phase 5.6-C — Section Progress PostgreSQL Persistence
-- =============================================================
--
-- Production-safety properties:
--   * additive only
--   * no existing Enrollment rows modified
--   * one SectionProgress aggregate per Enrollment + Section
--   * Enrollment deletion remains restricted
--   * Section identity remains application-level
--   * no artificial Section foreign key is introduced
--   * no OutboxEvent schema modification
--
-- The current Course Structure domain exposes Section as a
-- CourseVersion-owned domain entity, but Section itself does not
-- currently have a PostgreSQL persistence model.
--
-- Therefore sectionId intentionally remains an opaque application
-- identity at this persistence layer.
-- =============================================================

CREATE TYPE "SectionProgressStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED'
);

CREATE TABLE "SectionProgress" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,

  "status" "SectionProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',

  "percentage" INTEGER NOT NULL DEFAULT 0,

  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SectionProgress_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionProgress_enrollmentId_sectionId_key"
  ON "SectionProgress"("enrollmentId", "sectionId");

CREATE INDEX "SectionProgress_enrollmentId_status_idx"
  ON "SectionProgress"("enrollmentId", "status");

CREATE INDEX "SectionProgress_sectionId_status_idx"
  ON "SectionProgress"("sectionId", "status");

ALTER TABLE "SectionProgress"
  ADD CONSTRAINT "SectionProgress_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId")
  REFERENCES "Enrollment"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;