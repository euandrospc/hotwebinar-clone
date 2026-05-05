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
    pitchAtSec: w.pitchAtSec
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
