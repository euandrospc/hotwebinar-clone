-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "EventKind" ADD VALUE 'CTA_VIEW';

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "enterFired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaveFired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permanenceFired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pitchFired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "webinar" ADD COLUMN     "permanenceThresholdSec" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "webhookOnCtaClick" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnCtaView" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnEnter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnLeave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnOptin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnPermanence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookOnPitchReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "lead_chat_message" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "videoSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "leadId" TEXT,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cta_view" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ctaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cta_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_chat_message_leadId_createdAt_idx" ON "lead_chat_message"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_delivery_webinarId_status_createdAt_idx" ON "webhook_delivery"("webinarId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "cta_view_ctaId_idx" ON "cta_view"("ctaId");

-- CreateIndex
CREATE UNIQUE INDEX "cta_view_leadId_ctaId_key" ON "cta_view"("leadId", "ctaId");

-- AddForeignKey
ALTER TABLE "lead_chat_message" ADD CONSTRAINT "lead_chat_message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_chat_message" ADD CONSTRAINT "lead_chat_message_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cta_view" ADD CONSTRAINT "cta_view_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
