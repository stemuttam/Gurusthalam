/*
  Warnings:

  - A unique constraint covering the columns `[notificationId]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `notificationId` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "notificationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_notificationId_key" ON "Notification"("notificationId");
