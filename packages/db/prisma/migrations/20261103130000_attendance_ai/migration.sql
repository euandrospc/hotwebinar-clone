ALTER TABLE "webinar"
 ADD COLUMN "chatAiEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "chatAiName" TEXT NOT NULL DEFAULT 'Assistente',
 ADD COLUMN "chatAiInstructions" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "chatAiModel" TEXT NOT NULL DEFAULT 'gpt-4.1-mini';
ALTER TABLE "lead"
 ADD COLUMN "assignedAttendantId" TEXT,
 ADD COLUMN "aiPaused" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "chatVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "aiPendingMessageId" TEXT,
 ADD COLUMN "aiLeaseToken" TEXT,
 ADD COLUMN "aiLeaseUntil" TIMESTAMP(3),
 ADD COLUMN "aiAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "aiNextAttemptAt" TIMESTAMP(3),
 ADD COLUMN "aiError" TEXT;
ALTER TABLE "lead" ADD CONSTRAINT "lead_assignedAttendantId_fkey" FOREIGN KEY ("assignedAttendantId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_chat_message" ADD COLUMN "aiAgentName" TEXT;
CREATE INDEX "lead_chat_message_webinarId_createdAt_idx" ON "lead_chat_message"("webinarId", "createdAt");
CREATE INDEX "lead_chat_message_authorUserId_createdAt_idx" ON "lead_chat_message"("authorUserId", "createdAt");
CREATE INDEX "lead_ai_pending_idx" ON "lead"("aiNextAttemptAt") WHERE "aiPendingMessageId" IS NOT NULL AND "aiPaused" = false;
