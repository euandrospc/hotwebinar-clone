import type { Lead, Video, Webinar } from "@prisma/client";

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

export function publicVideoDto(v: Video | null): PublicVideo | null {
  if (!v) return null;
  return {
    hlsUrl: v.hlsUrl,
    durationSec: v.durationSec,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl
  };
}

export type PublicLead = {
  id: string;
  name: string;
};

export function publicLeadDto(l: Lead): PublicLead {
  return { id: l.id, name: l.name };
}
