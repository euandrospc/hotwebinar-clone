ALTER TABLE "webinar" ADD COLUMN "salesWebhookSecret" TEXT;
CREATE UNIQUE INDEX "webinar_salesWebhookSecret_key" ON "webinar"("salesWebhookSecret");

DROP INDEX IF EXISTS "account_settings_salesWebhookSecret_key";
ALTER TABLE "account_settings" DROP COLUMN IF EXISTS "salesWebhookSecret";
