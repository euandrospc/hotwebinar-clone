-- CreateEnum
CREATE TYPE "AbExperimentMode" AS ENUM ('OBSERVATIONAL', 'RANDOMIZED');

-- CreateEnum
CREATE TYPE "AbExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AbExperimentMetric" AS ENUM ('PURCHASE', 'OFFER_CLICK', 'PITCH_REACHED');

-- CreateEnum
CREATE TYPE "AbVariant" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "ab_experiment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "mode" "AbExperimentMode" NOT NULL,
    "status" "AbExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "metric" "AbExperimentMetric" NOT NULL DEFAULT 'PURCHASE',
    "webinarAId" TEXT NOT NULL,
    "webinarBId" TEXT NOT NULL,
    "baselineRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "minimumDetectableLift" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "sampleSizePerVariant" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "conversionWindowHours" INTEGER NOT NULL DEFAULT 72,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "webinarAFingerprint" TEXT,
    "webinarBFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_assignment" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "variant" "AbVariant" NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "device" TEXT,

    CONSTRAINT "ab_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ab_experiment_ownerId_createdAt_idx" ON "ab_experiment"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ab_assignment_experimentId_createdAt_idx" ON "ab_assignment"("experimentId", "createdAt");

-- CreateIndex
CREATE INDEX "ab_assignment_leadId_idx" ON "ab_assignment"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ab_assignment_experimentId_visitorId_key" ON "ab_assignment"("experimentId", "visitorId");

-- AddForeignKey
ALTER TABLE "ab_experiment" ADD CONSTRAINT "ab_experiment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_experiment" ADD CONSTRAINT "ab_experiment_webinarAId_fkey" FOREIGN KEY ("webinarAId") REFERENCES "webinar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_experiment" ADD CONSTRAINT "ab_experiment_webinarBId_fkey" FOREIGN KEY ("webinarBId") REFERENCES "webinar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_assignment" ADD CONSTRAINT "ab_assignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "ab_experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_assignment" ADD CONSTRAINT "ab_assignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

