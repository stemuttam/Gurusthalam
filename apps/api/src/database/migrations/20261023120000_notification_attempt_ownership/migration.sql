-- P0-2: Persist the worker attempt that currently owns lifecycle writes.
-- Nullable columns preserve existing rows and allow gradual rollout.
ALTER TABLE "Notification"
  ADD COLUMN "activeAttemptToken" TEXT;

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "activeAttemptToken" TEXT;
