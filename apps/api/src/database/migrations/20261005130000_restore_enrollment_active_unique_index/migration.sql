-- =============================================================
-- 5.1 — Restore Enrollment Active Concurrency Invariant
-- =============================================================
--
-- The original Enrollment migration is already recorded as
-- successfully applied in Prisma migration history.
--
-- The database, however, is missing the partial unique index
-- that guarantees at most one PENDING/ACTIVE Enrollment for
-- a learner/course pair.
--
-- Existing active/pending duplicate validation has been
-- performed before applying this migration.
--
-- Terminal historical states remain unrestricted:
--
-- COMPLETED
-- CANCELLED
-- EXPIRED
--
-- This index is the database-level concurrency authority.
-- =============================================================

CREATE UNIQUE INDEX "Enrollment_active_learner_course_unique"
ON "Enrollment" ("learnerId", "courseId")
WHERE "status" IN ('PENDING', 'ACTIVE');