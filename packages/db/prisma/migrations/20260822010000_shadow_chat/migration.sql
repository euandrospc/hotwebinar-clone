ALTER TABLE "lead_chat_message" ADD COLUMN "sender" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "lead_chat_message" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "lead_chat_message"
  ADD CONSTRAINT "lead_chat_message_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "webinar" ADD COLUMN "teamChatName" TEXT NOT NULL DEFAULT 'Suporte';
