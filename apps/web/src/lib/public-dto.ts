import type { Lead, Video, Webinar } from "db";

export type PublicWebinar = {
  id: string;
  slug: string | null;
  title: string;
  name: string;
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
  timezone: string;
  waitingTitle: string;
  waitingSubtitle: string;
  waitingShowThumb: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  loginButtonText: string;
  loginButtonColor: string;
  nameEnabled: boolean; nameRequired: boolean; namePlaceholder: string;
  emailEnabled: boolean; emailRequired: boolean; emailPlaceholder: string;
  phoneEnabled: boolean; phoneRequired: boolean; phonePlaceholder: string;
  pitchAtSec: number | null;
  waitingTemplate: "DEFAULT" | "WITH_THUMB" | "IMMERSIVE" | "MINIMAL" | "FEATURES";
  loginLogoAlign: "LEFT" | "CENTER" | "RIGHT";
  progressEnabled: boolean;
  progressStartPct: number;
  progressBarColor: string;
  progressTextColor: string;
  progressText: string;
  formFieldOrder: ReadonlyArray<"name" | "email" | "phone">;
  audienceMode: "NONE" | "FIXED" | "DYNAMIC";
  audienceMin: number;
  audienceMax: number;
  audienceLiveBadge: boolean;
  offerName: string;
  offerTitle: string;
  offerPriceOriginal: string | null;
  offerPriceFinal: string | null;
  offerButtonText: string;
  offerButtonColor: string;
  offerImageDesktopUrl: string | null;
  offerImageMobileUrl: string | null;
  offerShowAtSec: number | null;
  offerHideAtSec: number | null;
  offerLink: string | null;
  offerPassUtms: boolean;
  offerDisabled: boolean;
  offerSameWindow: boolean;
  offerRaffleEnabled: boolean;
};

export function publicWebinarDto(w: Webinar): PublicWebinar {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    name: w.name,
    mode: w.mode,
    startDate: w.startDate,
    endDate: w.endDate,
    timezone: w.timezone,
    waitingTitle: w.waitingTitle,
    waitingSubtitle: w.waitingSubtitle,
    waitingShowThumb: w.waitingShowThumb,
    logoUrl: w.logoUrl,
    primaryColor: w.primaryColor,
    loginButtonText: w.loginButtonText,
    loginButtonColor: w.loginButtonColor,
    nameEnabled: w.nameEnabled, nameRequired: w.nameRequired, namePlaceholder: w.namePlaceholder,
    emailEnabled: w.emailEnabled, emailRequired: w.emailRequired, emailPlaceholder: w.emailPlaceholder,
    phoneEnabled: w.phoneEnabled, phoneRequired: w.phoneRequired, phonePlaceholder: w.phonePlaceholder,
    pitchAtSec: w.pitchAtSec,
    waitingTemplate: w.waitingTemplate,
    loginLogoAlign: w.loginLogoAlign,
    progressEnabled: w.progressEnabled,
    progressStartPct: w.progressStartPct,
    progressBarColor: w.progressBarColor,
    progressTextColor: w.progressTextColor,
    progressText: w.progressText,
    formFieldOrder: w.formFieldOrder as ReadonlyArray<"name" | "email" | "phone">,
    audienceMode: w.audienceMode,
    audienceMin: w.audienceMin,
    audienceMax: w.audienceMax,
    audienceLiveBadge: w.audienceLiveBadge,
    offerName: w.offerName,
    offerTitle: w.offerTitle,
    offerPriceOriginal: w.offerPriceOriginal,
    offerPriceFinal: w.offerPriceFinal,
    offerButtonText: w.offerButtonText,
    offerButtonColor: w.offerButtonColor,
    offerImageDesktopUrl: w.offerImageDesktopUrl,
    offerImageMobileUrl: w.offerImageMobileUrl,
    offerShowAtSec: w.offerShowAtSec,
    offerHideAtSec: w.offerHideAtSec,
    offerLink: w.offerLink,
    offerPassUtms: w.offerPassUtms,
    offerDisabled: w.offerDisabled,
    offerSameWindow: w.offerSameWindow,
    offerRaffleEnabled: w.offerRaffleEnabled
  };
}

export type PublicVideo = {
  hlsUrl: string | null;
  durationSec: number | null;
  thumbUrl: string | null;
  customThumbUrl: string | null;
};

/**
 * Rewrite MinIO HLS-bucket URL to authenticated proxy `/api/hls/<key>` so
 * direct-bucket downloads are blocked. EXTERNAL hlsUrls (not under HLS bucket)
 * pass through unchanged.
 */
export function proxifyHlsUrl(url: string | null): string | null {
  if (!url) return null;
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? "";
  const hlsBucket = process.env.S3_BUCKET_HLS ?? process.env.NEXT_PUBLIC_S3_BUCKET_HLS ?? "hls-public";
  const prefix = `${publicBase}/${hlsBucket}/`;
  if (publicBase && url.startsWith(prefix)) {
    return `/api/hls/${url.slice(prefix.length)}`;
  }
  return url;
}

export function publicVideoDto(v: Video | null): PublicVideo | null {
  if (!v) return null;
  return {
    hlsUrl: proxifyHlsUrl(v.hlsUrl),
    durationSec: v.durationSec,
    thumbUrl: proxifyHlsUrl(v.thumbUrl),
    customThumbUrl: proxifyHlsUrl(v.customThumbUrl)
  };
}

export type PublicLead = {
  id: string;
  name: string;
};

export function publicLeadDto(l: Lead): PublicLead {
  return { id: l.id, name: l.name };
}

export type PublicLeadWithUtms = {
  id: string;
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};

export function publicLeadWithUtmsDto(l: Lead): PublicLeadWithUtms {
  return {
    id: l.id,
    name: l.name,
    utmSource: l.utmSource,
    utmMedium: l.utmMedium,
    utmCampaign: l.utmCampaign,
    utmTerm: l.utmTerm,
    utmContent: l.utmContent
  };
}

export type PublicSaleNotification = {
  id: string;
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
};

export function publicSaleNotificationDto(n: {
  id: string;
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
}): PublicSaleNotification {
  return {
    id: n.id,
    showAtSec: n.showAtSec,
    buyerName: n.buyerName,
    productName: n.productName,
    price: n.price
  };
}
