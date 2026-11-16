-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "reportReason" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedById" TEXT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "refundPct" INTEGER,
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "teacherResponse" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_studentId_lastMessageAt_idx" ON "Conversation"("studentId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_teacherId_lastMessageAt_idx" ON "Conversation"("teacherId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

