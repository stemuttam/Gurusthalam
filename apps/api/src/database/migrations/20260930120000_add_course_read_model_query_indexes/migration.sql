-- 4.14-H — CourseCatalogProjection query indexes
--
-- These indexes support deterministic pagination for the two timestamp
-- sort fields exposed by the Course query contract.
--
-- Query shape:
--
--   ORDER BY createdAt ASC|DESC, courseId ASC|DESC
--   ORDER BY updatedAt ASC|DESC, courseId ASC|DESC
--
-- courseId is the stable read-model identity and deterministic secondary
-- ordering key.

CREATE INDEX "CourseCatalogProjection_createdAt_courseId_idx"
ON "CourseCatalogProjection" ("createdAt", "courseId");

CREATE INDEX "CourseCatalogProjection_updatedAt_courseId_idx"
ON "CourseCatalogProjection" ("updatedAt", "courseId");