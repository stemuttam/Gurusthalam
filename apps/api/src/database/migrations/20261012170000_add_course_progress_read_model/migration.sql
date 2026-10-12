CREATE TABLE "CourseProgressReadModel" (
    "enrollmentId" TEXT NOT NULL,
    "courseVersionId" TEXT NOT NULL,
    "totalLearningUnits" INTEGER NOT NULL,
    "startedLearningUnits" INTEGER NOT NULL,
    "completedLearningUnits" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "hasLearningUnits" BOOLEAN NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseProgressReadModel_pkey"
        PRIMARY KEY ("enrollmentId"),

    CONSTRAINT "CourseProgressReadModel_totalLearningUnits_check"
        CHECK ("totalLearningUnits" >= 0),

    CONSTRAINT "CourseProgressReadModel_startedLearningUnits_check"
        CHECK (
            "startedLearningUnits" >= 0
            AND "startedLearningUnits" <= "totalLearningUnits"
        ),

    CONSTRAINT "CourseProgressReadModel_completedLearningUnits_check"
        CHECK (
            "completedLearningUnits" >= 0
            AND "completedLearningUnits" <= "startedLearningUnits"
        ),

    CONSTRAINT "CourseProgressReadModel_percentage_check"
        CHECK ("percentage" BETWEEN 0 AND 100),

    CONSTRAINT "CourseProgressReadModel_hasLearningUnits_check"
        CHECK ("hasLearningUnits" = ("totalLearningUnits" > 0)),

    CONSTRAINT "CourseProgressReadModel_empty_structure_percentage_check"
        CHECK ("totalLearningUnits" <> 0 OR "percentage" = 0)
);

CREATE INDEX "CourseProgressReadModel_courseVersionId_calculatedAt_idx"
    ON "CourseProgressReadModel"("courseVersionId", "calculatedAt");

CREATE INDEX "CourseProgressReadModel_calculatedAt_idx"
    ON "CourseProgressReadModel"("calculatedAt");

ALTER TABLE "CourseProgressReadModel"
    ADD CONSTRAINT "CourseProgressReadModel_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId")
    REFERENCES "Enrollment"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "CourseProgressReadModel"
    ADD CONSTRAINT "CourseProgressReadModel_courseVersionId_fkey"
    FOREIGN KEY ("courseVersionId")
    REFERENCES "CourseVersion"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;