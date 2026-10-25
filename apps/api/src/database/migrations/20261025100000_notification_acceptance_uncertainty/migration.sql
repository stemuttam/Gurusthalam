-- Durable state for provider submissions whose external outcome is unknown.
ALTER TYPE "NotificationDeliveryStatus"
  ADD VALUE IF NOT EXISTS 'ACCEPTANCE_UNKNOWN';

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "providerSubmissionStartedAt" TIMESTAMP(3);
