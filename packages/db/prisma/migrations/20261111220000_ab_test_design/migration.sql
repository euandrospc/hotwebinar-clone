ALTER TABLE "ab_experiment"
ADD COLUMN "testVariable" TEXT NOT NULL DEFAULT 'FULL_WEBINAR',
ADD COLUMN "variantADescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN "variantBDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN "webinarASnapshot" JSONB,
ADD COLUMN "webinarBSnapshot" JSONB;
