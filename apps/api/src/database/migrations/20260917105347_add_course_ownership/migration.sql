-- CreateEnum
CREATE TYPE "CourseOwnershipRole" AS ENUM ('OWNER', 'AUTHOR', 'CO_AUTHOR', 'EDITOR', 'REVIEWER', 'PUBLISHER');

-- CreateTable
CREATE TABLE "CourseOwnershipAssignment" (
    "courseId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "role" "CourseOwnershipRole" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CourseOwnershipAssignment_pkey" PRIMARY KEY ("courseId","principalId","role")
);

-- CreateIndex
CREATE INDEX "CourseOwnershipAssignment_courseId_role_idx" ON "CourseOwnershipAssignment"("courseId", "role");

-- CreateIndex
CREATE INDEX "CourseOwnershipAssignment_principalId_role_courseId_idx" ON "CourseOwnershipAssignment"("principalId", "role", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOwnershipAssignment_courseId_position_key" ON "CourseOwnershipAssignment"("courseId", "position");

-- AddForeignKey
ALTER TABLE "CourseOwnershipAssignment" ADD CONSTRAINT "CourseOwnershipAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
