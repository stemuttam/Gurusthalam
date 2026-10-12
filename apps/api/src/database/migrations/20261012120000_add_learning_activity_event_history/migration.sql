
-- =============================================================
-- Phase 5.8-D — Learning Activity History Persistence
-- =============================================================
--
-- Production-safety properties:
--   * additive table and indexes only
--   * unique eventId is the durable idempotency boundary
--   * complete validated activity payload is retained as JSONB
--   * indexed columns support activity-history query patterns
--   * no assumed learner/principal identity relationship
--   * no speculative Lesson, Section, or Assessment foreign keys
--   * no OutboxEvent changes
--
-- OutboxEvent remains a dispatch lifecycle table. This table stores
-- durable learner activity history independently of publication.
-- =============================================================

CREATE TABLE "LearningActivityEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "learnerId" TEXT NOT NULL,
  "tenantId" TEXT,
  "sessionId" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "context" JSONB NOT NULL,
  "metrics" JSONB,
  "metadata" JSONB,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LearningActivityEvent_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningActivityEvent_eventId_key"
  ON "LearningActivityEvent"("eventId");

CREATE INDEX "LearningActivityEvent_learnerId_occurredAt_eventId_idx"
  ON "LearningActivityEvent"("learnerId", "occurredAt", "eventId");

CREATE INDEX "LearningActivityEvent_tenantId_learnerId_occurredAt_idx"
  ON "LearningActivityEvent"("tenantId", "learnerId", "occurredAt");

CREATE INDEX "LearningActivityEvent_eventType_occurredAt_eventId_idx"
  ON "LearningActivityEvent"("eventType", "occurredAt", "eventId");

CREATE INDEX "LearningActivityEvent_entityType_entityId_occurredAt_eventId_idx"
  ON "LearningActivityEvent"("entityType", "entityId", "occurredAt", "eventId");

CREATE INDEX "LearningActivityEvent_sessionId_occurredAt_eventId_idx"
  ON "LearningActivityEvent"("sessionId", "occurredAt", "eventId");
