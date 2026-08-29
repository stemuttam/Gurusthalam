-- CreateEnum
CREATE TYPE "NotificationAggregationStatus" AS ENUM ('OPEN', 'FLUSHING', 'FLUSHED', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationAggregation" (
    "id" TEXT NOT NULL,
    "aggregationId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "category" TEXT NOT NULL,
    "aggregationKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "status" "NotificationAggregationStatus" NOT NULL DEFAULT 'OPEN',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAggregation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAggregationItem" (
    "id" TEXT NOT NULL,
    "aggregationId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "orderingKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAggregationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAggregation_aggregationId_key" ON "NotificationAggregation"("aggregationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAggregation_groupKey_key" ON "NotificationAggregation"("groupKey");

-- CreateIndex
CREATE INDEX "NotificationAggregation_userId_channel_status_idx" ON "NotificationAggregation"("userId", "channel", "status");

-- CreateIndex
CREATE INDEX "NotificationAggregation_status_windowEnd_idx" ON "NotificationAggregation"("status", "windowEnd");

-- CreateIndex
CREATE INDEX "NotificationAggregationItem_aggregationId_orderingKey_idx" ON "NotificationAggregationItem"("aggregationId", "orderingKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAggregationItem_aggregationId_sourceEventId_key" ON "NotificationAggregationItem"("aggregationId", "sourceEventId");

-- AddForeignKey
ALTER TABLE "NotificationAggregationItem" ADD CONSTRAINT "NotificationAggregationItem_aggregationId_fkey" FOREIGN KEY ("aggregationId") REFERENCES "NotificationAggregation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
