-- 1. Audience enum
CREATE TYPE "AudienceMode" AS ENUM ('NONE', 'FIXED', 'DYNAMIC');

-- 2. Webinar audience columns
ALTER TABLE "webinar"
  ADD COLUMN "audienceMode"      "AudienceMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "audienceMin"       INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "audienceMax"       INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "audienceLiveBadge" BOOLEAN NOT NULL DEFAULT true;

-- 3. Lead geo columns
ALTER TABLE "lead"
  ADD COLUMN "city"   TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "lat"    DOUBLE PRECISION,
  ADD COLUMN "lng"    DOUBLE PRECISION;
