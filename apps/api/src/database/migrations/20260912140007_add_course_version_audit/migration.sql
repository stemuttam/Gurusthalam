-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('SELF_PACED', 'LIVE', 'BLENDED');

-- CreateEnum
CREATE TYPE "CourseVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "OutboxEvent" ALTER COLUMN "lockedAt" SET DATA TYPE VARCHAR(255);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "CourseLevel" NOT NULL,
    "type" "CourseType" NOT NULL,
    "visibility" "CourseVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "instructorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVersion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CourseVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVersionAudit" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "CourseVersionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_instructorId_idx" ON "Course"("instructorId");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_visibility_idx" ON "Course"("visibility");

-- CreateIndex
CREATE INDEX "Course_status_visibility_idx" ON "Course"("status", "visibility");

-- CreateIndex
CREATE INDEX "Course_instructorId_status_idx" ON "Course"("instructorId", "status");

-- CreateIndex
CREATE INDEX "CourseVersion_courseId_status_idx" ON "CourseVersion"("courseId", "status");

-- CreateIndex
CREATE INDEX "CourseVersion_status_publishedAt_idx" ON "CourseVersion"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CourseVersion_courseId_status_version_idx" ON "CourseVersion"("courseId", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_courseId_version_key" ON "CourseVersion"("courseId", "version");

-- CreateIndex
CREATE INDEX "CourseVersionAudit_courseVersionId_occurredAt_id_idx" ON "CourseVersionAudit"("courseVersionId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "CourseVersionAudit_courseId_occurredAt_id_idx" ON "CourseVersionAudit"("courseId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "CourseVersionAudit_courseId_version_idx" ON "CourseVersionAudit"("courseId", "version");

-- CreateIndex
CREATE INDEX "CourseVersionAudit_eventType_occurredAt_idx" ON "CourseVersionAudit"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "CourseVersionAudit_actorType_actorId_idx" ON "CourseVersionAudit"("actorType", "actorId");

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersionAudit" ADD CONSTRAINT "CourseVersionAudit_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
