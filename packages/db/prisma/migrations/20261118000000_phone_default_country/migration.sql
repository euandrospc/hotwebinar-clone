-- Country the public WhatsApp field starts on. Existing webinars keep Brazil.
ALTER TABLE "webinar" ADD COLUMN "phoneDefaultCountry" TEXT NOT NULL DEFAULT 'BR';
