-- Phase 5.3 — Learning Session
--
-- Production-safety properties:
--   * additive only
--   * no existing Enrollment rows modified
--   * no existing migration modified
--   * historical Enrollment records remain untouched
--   * LearningSession references Enrollment with ON DELETE RESTRICT
--   * multiple historical sessions per Enrollment are allowed
--   * no "one active session per enrollment" database invariant is introduced
--
-- LearningSession is a transactional learning-domain aggregate.
-- Its lifecycle is represented by LearningSessionStatus.
--
-- Domain lifecycle:
--
--   ACTIVE <-> PAUSED
--   ACTIVE  -> COMPLETED
--   ACTIVE  -> ABANDONED
--   PAUSED  -> COMPLETED
--   PAUSED  -> ABANDONED
--
-- COMPLETED and ABANDONED are terminal states.
--
-- Domain events are persisted separately through OutboxEvent by the
-- application repository transaction. This migration therefore does
-- not modify OutboxEvent.

CREATE TYPE "LearningSessionStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ABANDONED'
);

CREATE TABLE "LearningSession" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,

  "status" "LearningSessionStatus" NOT NULL DEFAULT 'ACTIVE',

  "startedAt" TIMESTAMP(3) NOT NULL,
  "pausedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LearningSession_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX "LearningSession_enrollmentId_startedAt_idx"
ON "LearningSession" ("enrollmentId", "startedAt");

CREATE INDEX "LearningSession_status_endedAt_idx"
ON "LearningSession" ("status", "endedAt");

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId")
REFERENCES "Enrollment"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;