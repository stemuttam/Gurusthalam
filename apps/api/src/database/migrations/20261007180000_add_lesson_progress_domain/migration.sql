-- =============================================================
-- Phase 5.5-C — Lesson Progress PostgreSQL Persistence
-- =============================================================
--
-- Production-safety properties:
--   * additive only
--   * no existing Enrollment rows modified
--   * no existing migration modified
--   * historical Enrollment records remain untouched
--   * LessonProgress references Enrollment with ON DELETE RESTRICT
--   * one LessonProgress aggregate per
--       (Enrollment, LearningUnit)
--   * LearningUnit is intentionally NOT a database foreign key yet
--   * no learner/course/course-version duplication
--   * no analytics fields introduced
--   * no OutboxEvent schema modification
--
-- LessonProgress is the granular transactional progress aggregate
-- for one Course Structure LearningUnit within one Enrollment.
--
-- Domain lifecycle:
--
--   NOT_STARTED -> IN_PROGRESS -> COMPLETED
--
-- COMPLETED is terminal at the LessonProgress foundation layer.
--
-- Domain events are persisted separately through the LessonProgress
-- repository's transactional Outbox integration in Phase 5.5-D.
-- This migration therefore does not modify OutboxEvent.
--
-- IMPORTANT:
--
-- The current Course domain has no persisted LearningUnit Prisma model.
-- Therefore learningUnitId is deliberately persisted as an application
-- identity without a PostgreSQL foreign key.
--
-- A LearningUnit foreign key MUST NOT be invented here.
-- It may be introduced later when Course Structure persistence
-- establishes the authoritative LearningUnit table.
-- =============================================================


CREATE TYPE "LessonProgressStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED'
);


CREATE TABLE "LessonProgress" (
  "id" TEXT NOT NULL,

  "enrollmentId" TEXT NOT NULL,
  "learningUnitId" TEXT NOT NULL,

  "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',

  "percentage" INTEGER NOT NULL DEFAULT 0,

  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LessonProgress_pkey"
    PRIMARY KEY ("id")
);


-- =============================================================
-- Business identity / concurrency invariant
-- =============================================================
--
-- Exactly one LessonProgress aggregate may exist for one:
--
--   (enrollmentId, learningUnitId)
--
-- This is a database-level correctness guarantee.
--
-- Application-level existence checks are NOT sufficient because
-- concurrent transactions can otherwise both observe that the
-- aggregate does not exist and create duplicates.
-- =============================================================

CREATE UNIQUE INDEX "LessonProgress_enrollmentId_learningUnitId_key"
ON "LessonProgress" ("enrollmentId", "learningUnitId");


-- =============================================================
-- Query indexes
-- =============================================================
--
-- Enrollment-centric retrieval:
--
--   all LessonProgress records for an Enrollment
--   filtered by lifecycle status
-- =============================================================

CREATE INDEX "LessonProgress_enrollmentId_status_idx"
ON "LessonProgress" ("enrollmentId", "status");


-- =============================================================
-- LearningUnit-centric retrieval
-- =============================================================
--
-- This supports future Learning Intelligence / read-model
-- projections without making LessonProgress responsible for
-- analytics or knowledge-graph concerns.
-- =============================================================

CREATE INDEX "LessonProgress_learningUnitId_status_idx"
ON "LessonProgress" ("learningUnitId", "status");


-- =============================================================
-- Referential integrity
-- =============================================================
--
-- LessonProgress cannot outlive its Enrollment.
--
-- No LearningUnit FK is intentionally created because the current
-- transactional Prisma schema does not yet contain a LearningUnit
-- persistence model.
-- =============================================================

ALTER TABLE "LessonProgress"
ADD CONSTRAINT "LessonProgress_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId")
REFERENCES "Enrollment"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;