-- CreateTable
CREATE TABLE "CourseVersionLineage" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "targetVersionId" TEXT NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "relation" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVersionLineage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseVersionLineage_courseId_sourceVersion_targetVersion_idx" ON "CourseVersionLineage"("courseId", "sourceVersion", "targetVersion");

-- CreateIndex
CREATE INDEX "CourseVersionLineage_courseId_targetVersion_idx" ON "CourseVersionLineage"("courseId", "targetVersion");

-- CreateIndex
CREATE INDEX "CourseVersionLineage_sourceVersionId_idx" ON "CourseVersionLineage"("sourceVersionId");

-- CreateIndex
CREATE INDEX "CourseVersionLineage_targetVersionId_idx" ON "CourseVersionLineage"("targetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersionLineage_sourceVersionId_targetVersionId_relati_key" ON "CourseVersionLineage"("sourceVersionId", "targetVersionId", "relation");

-- AddForeignKey
ALTER TABLE "CourseVersionLineage" ADD CONSTRAINT "CourseVersionLineage_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "CourseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersionLineage" ADD CONSTRAINT "CourseVersionLineage_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "CourseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
