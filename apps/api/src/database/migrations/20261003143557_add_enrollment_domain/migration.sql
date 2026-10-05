-- =============================================================
-- 5.1 — Enrollment Domain
-- =============================================================

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM (
  'DIRECT',
  'COHORT',
  'ORGANIZATION',
  'SUBSCRIPTION'
);

-- CreateTable
CREATE TABLE "Enrollment" (
  "id" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "courseVersionId" TEXT NOT NULL,

  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "EnrollmentSource" NOT NULL,

  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),

  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Enrollment_pkey"
    PRIMARY KEY ("id")
);

-- =============================================================
-- Active Enrollment concurrency invariant
-- =============================================================
--
-- A learner may have at most one PENDING or ACTIVE Enrollment
-- for a Course.
--
-- Historical terminal states remain allowed:
--
-- COMPLETED
-- CANCELLED
-- EXPIRED
--
-- This is the database-level concurrency guarantee.
-- The application-level duplicate check is only a fast-fail
-- optimization and is not relied upon for correctness.
-- =============================================================

CREATE UNIQUE INDEX "Enrollment_active_learner_course_unique"
ON "Enrollment" ("learnerId", "courseId")
WHERE "status" IN ('PENDING', 'ACTIVE');

-- =============================================================
-- Query indexes
-- =============================================================

CREATE INDEX "Enrollment_learnerId_status_createdAt_idx"
ON "Enrollment" (
  "learnerId",
  "status",
  "createdAt"
);

CREATE INDEX "Enrollment_courseId_status_createdAt_idx"
ON "Enrollment" (
  "courseId",
  "status",
  "createdAt"
);

CREATE INDEX "Enrollment_courseVersionId_status_idx"
ON "Enrollment" (
  "courseVersionId",
  "status"
);

CREATE INDEX "Enrollment_status_expiresAt_idx"
ON "Enrollment" (
  "status",
  "expiresAt"
);

-- =============================================================
-- Referential integrity
-- =============================================================

ALTER TABLE "Enrollment"
ADD CONSTRAINT "Enrollment_courseId_fkey"
FOREIGN KEY ("courseId")
REFERENCES "Course"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Enrollment"
ADD CONSTRAINT "Enrollment_courseVersionId_fkey"
FOREIGN KEY ("courseVersionId")
REFERENCES "CourseVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;