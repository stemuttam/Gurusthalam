-- =============================================================
-- Phase 5.4 — Progress Foundation
-- =============================================================
--
-- Production-safety properties:
--   * additive only
--   * no existing Enrollment rows modified
--   * no existing migration modified
--   * historical Enrollment records remain untouched
--   * Progress references Enrollment with ON DELETE RESTRICT
--   * one foundational Progress aggregate per Enrollment
--   * no Lesson / Section / Course progress data introduced
--   * no OutboxEvent schema modification
--
-- Progress is the foundational transactional progress aggregate.
--
-- Domain lifecycle:
--
--   NOT_STARTED -> IN_PROGRESS -> COMPLETED
--
-- COMPLETED is terminal at the foundation layer.
--
-- Domain events are persisted separately through the Progress
-- repository's transactional Outbox integration. This migration
-- therefore does not modify OutboxEvent.
-- =============================================================

CREATE TYPE "ProgressStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED'
);

CREATE TABLE "Progress" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,

  "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',

  "percentage" INTEGER NOT NULL DEFAULT 0,

  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Progress_pkey"
    PRIMARY KEY ("id")
);

-- =============================================================
-- Foundational Progress ownership invariant
-- =============================================================
--
-- One Enrollment owns at most one foundational Progress aggregate.
--
-- This is a database-level concurrency guarantee.
-- Application-level existence checks must never be treated as the
-- correctness mechanism because concurrent transactions can both
-- observe the absence of a row.
-- =============================================================

CREATE UNIQUE INDEX "Progress_enrollmentId_key"
ON "Progress" ("enrollmentId");

-- =============================================================
-- Referential integrity
-- =============================================================

ALTER TABLE "Progress"
ADD CONSTRAINT "Progress_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId")
REFERENCES "Enrollment"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;