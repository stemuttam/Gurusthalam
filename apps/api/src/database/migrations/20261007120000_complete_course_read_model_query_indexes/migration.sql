-- Course Read Model query-index completion
--
-- Completes the PostgreSQL index contract declared by the Prisma schema
-- for CourseCatalogProjection and CourseSearchProjection.
--
-- The original 4.14-H migration intentionally created the deterministic
-- CourseCatalogProjection pagination indexes:
--
--   (createdAt, courseId)
--   (updatedAt, courseId)
--
-- This migration adds only the remaining schema-declared indexes that
-- were previously absent from migration history.
--
-- No existing indexes are recreated or modified.
-- No transactional Course data is changed.
-- No projection rows are changed.
--
-- CourseCatalogProjection:
--   title
--   createdAt
--
-- CourseSearchProjection:
--   title
--   createdAt
--   (createdAt, courseId)
--   (updatedAt, courseId)

CREATE INDEX "CourseCatalogProjection_title_idx"
ON "CourseCatalogProjection" ("title");

CREATE INDEX "CourseCatalogProjection_createdAt_idx"
ON "CourseCatalogProjection" ("createdAt");

CREATE INDEX "CourseSearchProjection_title_idx"
ON "CourseSearchProjection" ("title");

CREATE INDEX "CourseSearchProjection_createdAt_idx"
ON "CourseSearchProjection" ("createdAt");

CREATE INDEX "CourseSearchProjection_createdAt_courseId_idx"
ON "CourseSearchProjection" ("createdAt", "courseId");

CREATE INDEX "CourseSearchProjection_updatedAt_courseId_idx"
ON "CourseSearchProjection" ("updatedAt", "courseId");