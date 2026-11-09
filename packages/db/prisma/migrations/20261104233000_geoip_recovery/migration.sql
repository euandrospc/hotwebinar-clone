CREATE TYPE "GeoIpStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

CREATE TABLE "geo_ip_lookup" (
    "ip" TEXT NOT NULL,
    "status" "GeoIpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "lastError" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "geo_ip_lookup_pkey" PRIMARY KEY ("ip")
);

CREATE TABLE "geo_ip_provider_state" (
    "id" TEXT NOT NULL,
    "nextRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    CONSTRAINT "geo_ip_provider_state_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "geo_ip_lookup_status_nextAttemptAt_idx" ON "geo_ip_lookup"("status", "nextAttemptAt");
CREATE INDEX "lead_ip_idx" ON "lead"("ip");
