ALTER TABLE "webinar"
  ADD COLUMN "chatInsightLeaseToken" TEXT,
  ADD COLUMN "chatInsightLeaseUntil" TIMESTAMP(3);

CREATE TABLE "lead_chat_message_analysis" (
  "messageId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "objections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "questions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_chat_message_analysis_pkey" PRIMARY KEY ("messageId")
);
CREATE INDEX "lead_chat_message_analysis_version_model_idx"
  ON "lead_chat_message_analysis"("version", "model");
ALTER TABLE "lead_chat_message_analysis"
  ADD CONSTRAINT "lead_chat_message_analysis_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "lead_chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
