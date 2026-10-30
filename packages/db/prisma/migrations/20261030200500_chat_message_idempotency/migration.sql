ALTER TABLE "lead_chat_message" ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "lead_chat_message_leadId_clientMessageId_key"
ON "lead_chat_message"("leadId", "clientMessageId");
