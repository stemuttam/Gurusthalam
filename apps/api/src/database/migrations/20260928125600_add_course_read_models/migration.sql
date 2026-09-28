-- CreateTable
CREATE TABLE "CourseCatalogProjection" (
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "CourseLevel" NOT NULL,
    "type" "CourseType" NOT NULL,
    "visibility" "CourseVisibility" NOT NULL,
    "status" "CourseStatus" NOT NULL,
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectionSchemaVersion" INTEGER NOT NULL,

    CONSTRAINT "CourseCatalogProjection_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "CourseSearchProjection" (
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "CourseLevel" NOT NULL,
    "type" "CourseType" NOT NULL,
    "visibility" "CourseVisibility" NOT NULL,
    "status" "CourseStatus" NOT NULL,
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectionSchemaVersion" INTEGER NOT NULL,
    "searchText" TEXT NOT NULL,
    "searchProjectionSchemaVersion" INTEGER NOT NULL,

    CONSTRAINT "CourseSearchProjection_pkey" PRIMARY KEY ("courseId")
);

-- CreateIndex
CREATE INDEX "CourseCatalogProjection_status_visibility_idx" ON "CourseCatalogProjection"("status", "visibility");

-- CreateIndex
CREATE INDEX "CourseCatalogProjection_instructorId_status_idx" ON "CourseCatalogProjection"("instructorId", "status");

-- CreateIndex
CREATE INDEX "CourseCatalogProjection_level_idx" ON "CourseCatalogProjection"("level");

-- CreateIndex
CREATE INDEX "CourseCatalogProjection_type_idx" ON "CourseCatalogProjection"("type");

-- CreateIndex
CREATE INDEX "CourseCatalogProjection_updatedAt_idx" ON "CourseCatalogProjection"("updatedAt");

-- CreateIndex
CREATE INDEX "CourseSearchProjection_status_visibility_idx" ON "CourseSearchProjection"("status", "visibility");

-- CreateIndex
CREATE INDEX "CourseSearchProjection_instructorId_status_idx" ON "CourseSearchProjection"("instructorId", "status");

-- CreateIndex
CREATE INDEX "CourseSearchProjection_level_idx" ON "CourseSearchProjection"("level");

-- CreateIndex
CREATE INDEX "CourseSearchProjection_type_idx" ON "CourseSearchProjection"("type");

-- CreateIndex
CREATE INDEX "CourseSearchProjection_updatedAt_idx" ON "CourseSearchProjection"("updatedAt");
