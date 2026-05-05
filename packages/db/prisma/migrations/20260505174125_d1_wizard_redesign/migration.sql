-- CreateEnum
CREATE TYPE "WaitingTemplate" AS ENUM ('DEFAULT', 'WITH_THUMB', 'IMMERSIVE', 'MINIMAL', 'FEATURES');

-- CreateEnum
CREATE TYPE "LogoAlign" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- AlterTable
ALTER TABLE "webinar" ADD COLUMN     "accessFacilitated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formFieldOrder" TEXT[] DEFAULT ARRAY['name', 'email', 'phone']::TEXT[],
ADD COLUMN     "loginLogoAlign" "LogoAlign" NOT NULL DEFAULT 'CENTER',
ADD COLUMN     "progressBarColor" TEXT NOT NULL DEFAULT '#dc2626',
ADD COLUMN     "progressEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "progressStartPct" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "progressText" TEXT NOT NULL DEFAULT '{pct}% das vagas preenchidas...',
ADD COLUMN     "progressTextColor" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "videoSyncWithStart" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waitingTemplate" "WaitingTemplate" NOT NULL DEFAULT 'DEFAULT';
