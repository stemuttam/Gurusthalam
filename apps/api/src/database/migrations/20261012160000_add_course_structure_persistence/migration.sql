
CREATE TABLE "CourseStructureSection" (
    "id" TEXT NOT NULL,
    "courseVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseStructureSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseStructureLearningUnit" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseStructureLearningUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseStructureContentItemReference" (
    "id" TEXT NOT NULL,
    "learningUnitId" TEXT NOT NULL,
    "contentItemTargetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CourseStructureContentItemReference_pkey"
        PRIMARY KEY ("id")
);

CREATE TABLE "CourseStructureAssessmentReference" (
    "id" TEXT NOT NULL,
    "learningUnitId" TEXT NOT NULL,
    "assessmentTargetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CourseStructureAssessmentReference_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseStructureSection_courseVersionId_position_key"
    ON "CourseStructureSection"("courseVersionId", "position");

CREATE INDEX "CourseStructureSection_courseVersionId_id_idx"
    ON "CourseStructureSection"("courseVersionId", "id");

CREATE UNIQUE INDEX "CourseStructureLearningUnit_sectionId_position_key"
    ON "CourseStructureLearningUnit"("sectionId", "position");

CREATE INDEX "CourseStructureLearningUnit_sectionId_id_idx"
    ON "CourseStructureLearningUnit"("sectionId", "id");

CREATE UNIQUE INDEX "CourseStructureContentItemReference_learningUnitId_position_key"
    ON "CourseStructureContentItemReference"("learningUnitId", "position");

CREATE INDEX "CourseStructureContentItemReference_contentItemTargetId_idx"
    ON "CourseStructureContentItemReference"("contentItemTargetId");

CREATE UNIQUE INDEX "CourseStructureAssessmentReference_learningUnitId_position_key"
    ON "CourseStructureAssessmentReference"("learningUnitId", "position");

CREATE INDEX "CourseStructureAssessmentReference_assessmentTargetId_idx"
    ON "CourseStructureAssessmentReference"("assessmentTargetId");

ALTER TABLE "CourseStructureSection"
    ADD CONSTRAINT "CourseStructureSection_courseVersionId_fkey"
    FOREIGN KEY ("courseVersionId")
    REFERENCES "CourseVersion"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "CourseStructureLearningUnit"
    ADD CONSTRAINT "CourseStructureLearningUnit_sectionId_fkey"
    FOREIGN KEY ("sectionId")
    REFERENCES "CourseStructureSection"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "CourseStructureContentItemReference"
    ADD CONSTRAINT "CourseStructureContentItemReference_learningUnitId_fkey"
    FOREIGN KEY ("learningUnitId")
    REFERENCES "CourseStructureLearningUnit"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "CourseStructureAssessmentReference"
    ADD CONSTRAINT "CourseStructureAssessmentReference_learningUnitId_fkey"
    FOREIGN KEY ("learningUnitId")
    REFERENCES "CourseStructureLearningUnit"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
