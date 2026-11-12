import { createHash } from "node:crypto";
import type { Webinar } from "db";

const fields = [
  "videoId", "slug", "name", "title", "language", "mode", "startDate", "endDate", "recurring", "recurringDays", "timezone",
  "waitingTitle", "teamChatName", "waitingSubtitle", "waitingShowThumb", "accessFacilitated", "videoSyncWithStart", "waitingTemplate", "closedGroupUrl",
  "loginLogoAlign", "progressEnabled", "progressStartPct", "progressBarColor", "progressTextColor", "progressText", "formFieldOrder", "logoUrl", "primaryColor",
  "loginButtonText", "loginButtonColor", "nameEnabled", "nameRequired", "emailEnabled", "emailRequired", "phoneEnabled", "phoneRequired",
  "namePlaceholder", "emailPlaceholder", "phonePlaceholder", "pitchAtSec", "chatAiEnabled", "chatAiName", "chatAiInstructions", "chatAiModel",
  "offerName", "offerTitleStyle", "offerTitle", "offerPriceOriginal", "offerPriceFinal", "offerButtonText", "offerButtonColor",
  "offerImageDesktopUrl", "offerImageMobileUrl", "offerShowAtSec", "offerHideAtSec", "offerLink", "offerPassUtms", "offerDisabled", "offerSameWindow",
  "offerRaffleEnabled", "offerRaffleAtSec", "offerRaffleNumber", "audienceMode", "audienceMin", "audienceMax", "audienceLiveBadge"
] as const satisfies readonly (keyof Webinar)[];

/** Hash only experimental behavior/content; unrelated leases and update timestamps do not cause drift. */
export function webinarFingerprint(webinar: Pick<Webinar, typeof fields[number]>): string {
  return createHash("sha256").update(JSON.stringify(fields.map((key) => [key, webinar[key]]))).digest("hex");
}
