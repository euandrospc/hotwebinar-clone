ALTER TABLE "account_settings" ADD COLUMN "salesWebhookSecret" TEXT;
CREATE UNIQUE INDEX "account_settings_salesWebhookSecret_key" ON "account_settings"("salesWebhookSecret");
