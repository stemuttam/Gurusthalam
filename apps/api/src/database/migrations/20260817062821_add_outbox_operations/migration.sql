-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE 'DEAD_LETTER';

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "deadLetteredAt" TIMESTAMP(3),
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "recoveredAt" TIMESTAMP(3),
ADD COLUMN     "recoveryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "OutboxEvent_deadLetteredAt_idx" ON "OutboxEvent"("deadLetteredAt");
