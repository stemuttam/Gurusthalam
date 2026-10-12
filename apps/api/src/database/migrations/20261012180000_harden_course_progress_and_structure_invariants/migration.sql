-- Phase 5.7-H-A: enforce Course Structure and Course Progress invariants.
--
-- This is an additive migration. Do not modify previously applied migrations.
--
-- Course Structure positions are 1-based and must remain positive even when
-- persistence is accessed without going through the domain model.
ALTER TABLE "CourseStructureSection"
  ADD CONSTRAINT "CourseStructureSection_position_positive_check"
  CHECK ("position" >= 1);

ALTER TABLE "CourseStructureLearningUnit"
  ADD CONSTRAINT "CourseStructureLearningUnit_position_positive_check"
  CHECK ("position" >= 1);

ALTER TABLE "CourseStructureContentItemReference"
  ADD CONSTRAINT "CourseStructureContentItemReference_position_positive_check"
  CHECK ("position" >= 1);

ALTER TABLE "CourseStructureAssessmentReference"
  ADD CONSTRAINT "CourseStructureAssessmentReference_position_positive_check"
  CHECK ("position" >= 1);

-- The composite target must be unique for PostgreSQL's composite foreign key.
-- Enrollment.id is already a primary key; this additional unique key allows
-- the database to validate the enrollment/CourseVersion pair as one identity.
ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_id_courseVersionId_key"
  UNIQUE ("id", "courseVersionId");

-- The read model may reference a CourseVersion only when that same version
-- belongs to the referenced Enrollment. Keep the existing independent
-- CourseVersion foreign key as an additional referential-integrity guarantee.
ALTER TABLE "CourseProgressReadModel"
  ADD CONSTRAINT "CourseProgressReadModel_enrollmentId_courseVersionId_fkey"
  FOREIGN KEY ("enrollmentId", "courseVersionId")
  REFERENCES "Enrollment" ("id", "courseVersionId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
