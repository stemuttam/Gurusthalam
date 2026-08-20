CREATE TYPE "NotificationTemplateChannel" AS ENUM (
  'EMAIL',
  'IN_APP',
  'PUSH'
);

CREATE TYPE "NotificationTemplateStatus" AS ENUM (
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE "NotificationTemplateCategory" AS ENUM (
  'SYSTEM',
  'SECURITY',
  'AUTHENTICATION',
  'COURSE',
  'LEARNING',
  'PAYMENT',
  'SUBSCRIPTION',
  'CERTIFICATE',
  'CORPORATE',
  'MARKETING',
  'REMINDER'
);

CREATE TABLE "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "channel" "NotificationTemplateChannel" NOT NULL,
  "category" "NotificationTemplateCategory" NOT NULL,
  "locale" TEXT NOT NULL,
  "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationTemplate_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "NotificationTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "subject" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "variables" JSONB NOT NULL,
  "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "NotificationTemplateVersion_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_templateId_key"
  ON "NotificationTemplate"("templateId");

CREATE INDEX "NotificationTemplate_channel_status_idx"
  ON "NotificationTemplate"("channel", "status");

CREATE INDEX "NotificationTemplate_category_status_idx"
  ON "NotificationTemplate"("category", "status");

CREATE INDEX "NotificationTemplate_locale_status_idx"
  ON "NotificationTemplate"("locale", "status");

CREATE INDEX "NotificationTemplate_createdBy_createdAt_idx"
  ON "NotificationTemplate"("createdBy", "createdAt");

CREATE UNIQUE INDEX "NotificationTemplateVersion_templateId_version_key"
  ON "NotificationTemplateVersion"("templateId", "version");

CREATE INDEX "NotificationTemplateVersion_templateId_status_idx"
  ON "NotificationTemplateVersion"("templateId", "status");

CREATE INDEX "NotificationTemplateVersion_status_publishedAt_idx"
  ON "NotificationTemplateVersion"("status", "publishedAt");

CREATE INDEX "NotificationTemplateVersion_createdBy_createdAt_idx"
  ON "NotificationTemplateVersion"("createdBy", "createdAt");

ALTER TABLE "NotificationTemplateVersion"
ADD CONSTRAINT "NotificationTemplateVersion_templateId_fkey"
FOREIGN KEY ("templateId")
REFERENCES "NotificationTemplate"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;