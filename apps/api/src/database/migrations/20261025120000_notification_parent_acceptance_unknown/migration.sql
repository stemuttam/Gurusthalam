-- Persist an indeterminate parent notification outcome when a provider may have
-- accepted a submission but no reliable provider message ID was persisted.
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'ACCEPTANCE_UNKNOWN';
