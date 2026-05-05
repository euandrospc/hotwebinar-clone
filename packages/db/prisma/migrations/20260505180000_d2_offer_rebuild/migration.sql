-- 1. Drop legacy CTA tables (cascade drops indexes/relations)
DROP TABLE IF EXISTS "cta_view" CASCADE;
DROP TABLE IF EXISTS "cta" CASCADE;

-- 2. Drop legacy webhook flags
ALTER TABLE "webinar"
  DROP COLUMN IF EXISTS "webhookOnCtaView",
  DROP COLUMN IF EXISTS "webhookOnCtaClick";

-- 3. Rename EventKind values (preserves existing event rows)
ALTER TYPE "EventKind" RENAME VALUE 'CTA_VIEW' TO 'OFFER_VIEW';
ALTER TYPE "EventKind" RENAME VALUE 'CTA_CLICK' TO 'OFFER_CLICK';
ALTER TYPE "EventKind" ADD VALUE 'RAFFLE_ENTRY';

-- 4. Add offer columns to webinar
ALTER TABLE "webinar"
  ADD COLUMN "offerName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offerTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offerPriceOriginal" TEXT,
  ADD COLUMN "offerPriceFinal" TEXT,
  ADD COLUMN "offerButtonText" TEXT NOT NULL DEFAULT 'Quero aproveitar',
  ADD COLUMN "offerButtonColor" TEXT NOT NULL DEFAULT '#dc2626',
  ADD COLUMN "offerImageDesktopUrl" TEXT,
  ADD COLUMN "offerImageMobileUrl" TEXT,
  ADD COLUMN "offerShowAtSec" INTEGER,
  ADD COLUMN "offerHideAtSec" INTEGER,
  ADD COLUMN "offerLink" TEXT,
  ADD COLUMN "offerPassUtms" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerDisabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerSameWindow" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerRaffleEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 5. Add new webhook flag columns
ALTER TABLE "webinar"
  ADD COLUMN "webhookOnOfferView" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnOfferClick" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnRaffleEntry" BOOLEAN NOT NULL DEFAULT false;

-- 6. Add UTM columns to lead
ALTER TABLE "lead"
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT;
