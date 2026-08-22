-- DropIndex
DROP INDEX "NotificationDelivery_notificationId_idx";

-- DropIndex
DROP INDEX "NotificationDelivery_status_lastAttemptAt_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "templateLocale" TEXT,
ADD COLUMN     "templateSnapshot" JSONB,
ADD COLUMN     "templateVersion" INTEGER;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_channel_status_idx" ON "Notification"("channel", "status");

-- CreateIndex
CREATE INDEX "Notification_template_templateVersion_idx" ON "Notification"("template", "templateVersion");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_createdAt_idx" ON "NotificationDelivery"("notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");
