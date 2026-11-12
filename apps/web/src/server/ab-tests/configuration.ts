import type { Prisma } from "db";
import type { AbVariantConfiguration } from "@/lib/ab-tests";

export const abConfigurationSelect = {
  title: true, name: true, mode: true, timezone: true, startDate: true, endDate: true, recurring: true, recurringDays: true,
  pitchAtSec: true, videoSyncWithStart: true, offerTitle: true, offerPriceOriginal: true, offerPriceFinal: true,
  offerShowAtSec: true, offerHideAtSec: true, offerLink: true, offerDisabled: true, offerButtonText: true,
  offerPassUtms: true, accessFacilitated: true, nameEnabled: true, emailEnabled: true, phoneEnabled: true,
  chatAiEnabled: true, chatAiName: true, audienceMode: true,
  video: { select: { name: true, durationSec: true } }
} as const satisfies Prisma.WebinarSelect;
type ConfiguredWebinar = Prisma.WebinarGetPayload<{ select: typeof abConfigurationSelect }>;

export function snapshotAbConfiguration(webinar: ConfiguredWebinar): AbVariantConfiguration {
  return {
    version: 1, title: webinar.title || webinar.name, mode: webinar.mode, timezone: webinar.timezone ?? "America/Sao_Paulo",
    startAt: webinar.startDate?.toISOString() ?? null, endAt: webinar.endDate?.toISOString() ?? null,
    recurring: webinar.recurring ?? false, recurringDays: webinar.recurringDays ?? [],
    videoName: webinar.video?.name ?? null, videoDurationSec: webinar.video?.durationSec ?? null,
    pitchAtSec: webinar.pitchAtSec ?? null, videoSyncWithStart: webinar.videoSyncWithStart ?? false,
    offerTitle: webinar.offerTitle ?? "", offerPriceOriginal: webinar.offerPriceOriginal ?? null, offerPriceFinal: webinar.offerPriceFinal ?? null,
    offerShowAtSec: webinar.offerShowAtSec ?? null, offerHideAtSec: webinar.offerHideAtSec ?? null, offerLink: webinar.offerLink ?? null,
    offerDisabled: webinar.offerDisabled ?? false, offerButtonText: webinar.offerButtonText ?? "", offerPassUtms: webinar.offerPassUtms ?? false,
    accessFacilitated: webinar.accessFacilitated ?? false,
    fields: { name: webinar.nameEnabled ?? false, email: webinar.emailEnabled ?? false, phone: webinar.phoneEnabled ?? false },
    chatAiEnabled: webinar.chatAiEnabled ?? false, chatAiName: webinar.chatAiName ?? "", audienceMode: webinar.audienceMode ?? "NONE"
  };
}

export function readAbConfigurationSnapshot(value: unknown): AbVariantConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<AbVariantConfiguration>;
  if (snapshot.version !== 1 || !["UNICO", "JIT"].includes(snapshot.mode ?? "") || !Array.isArray(snapshot.recurringDays) || !snapshot.fields) return null;
  return snapshot as AbVariantConfiguration;
}
