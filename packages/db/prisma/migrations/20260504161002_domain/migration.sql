-- CreateEnum
CREATE TYPE "WebinarMode" AS ENUM ('UNICO', 'JIT');

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('EXTERNAL', 'UPLOAD');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('OPTIN', 'PAGE_VIEW', 'VIDEO_START', 'VIDEO_TICK', 'VIDEO_END', 'CTA_CLICK', 'PITCH_REACHED');

-- CreateTable
CREATE TABLE "account_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'pt-BR',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "brandName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "VideoSource" NOT NULL,
    "originalUrl" TEXT,
    "hlsUrl" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "bytes" BIGINT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "videoId" TEXT,
    "slug" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "status" "WebinarStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "WebinarMode" NOT NULL DEFAULT 'UNICO',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "waitingTitle" TEXT NOT NULL DEFAULT 'Sala de Espera',
    "waitingSubtitle" TEXT NOT NULL DEFAULT 'Estamos prestes a começar',
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "loginButtonText" TEXT NOT NULL DEFAULT 'Entrar',
    "loginButtonColor" TEXT NOT NULL DEFAULT '#16a34a',
    "nameEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nameRequired" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailRequired" BOOLEAN NOT NULL DEFAULT true,
    "phoneEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phoneRequired" BOOLEAN NOT NULL DEFAULT false,
    "namePlaceholder" TEXT NOT NULL DEFAULT 'Seu nome',
    "emailPlaceholder" TEXT NOT NULL DEFAULT 'Seu e-mail',
    "phonePlaceholder" TEXT NOT NULL DEFAULT 'Seu telefone',
    "pitchAtSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "showAtSec" INTEGER NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cta" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "showAtSec" INTEGER NOT NULL,
    "hideAtSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "country" TEXT,
    "watchedSec" INTEGER NOT NULL DEFAULT 0,
    "reachedPitch" BOOLEAN NOT NULL DEFAULT false,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "sessionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "leadId" TEXT,
    "kind" "EventKind" NOT NULL,
    "videoSec" INTEGER,
    "ctaId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_settings_userId_key" ON "account_settings"("userId");

-- CreateIndex
CREATE INDEX "video_ownerId_createdAt_idx" ON "video"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webinar_slug_key" ON "webinar"("slug");

-- CreateIndex
CREATE INDEX "webinar_ownerId_status_idx" ON "webinar"("ownerId", "status");

-- CreateIndex
CREATE INDEX "chat_message_webinarId_showAtSec_idx" ON "chat_message"("webinarId", "showAtSec");

-- CreateIndex
CREATE INDEX "cta_webinarId_showAtSec_idx" ON "cta"("webinarId", "showAtSec");

-- CreateIndex
CREATE INDEX "lead_webinarId_sessionStart_idx" ON "lead"("webinarId", "sessionStart");

-- CreateIndex
CREATE UNIQUE INDEX "lead_webinarId_email_key" ON "lead"("webinarId", "email");

-- CreateIndex
CREATE INDEX "event_webinarId_kind_createdAt_idx" ON "event"("webinarId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "event_leadId_kind_idx" ON "event"("leadId", "kind");

-- AddForeignKey
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video" ADD CONSTRAINT "video_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar" ADD CONSTRAINT "webinar_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar" ADD CONSTRAINT "webinar_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cta" ADD CONSTRAINT "cta_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
