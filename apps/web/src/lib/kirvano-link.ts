// Tags Kirvano checkout links sent to a lead with `utm_content=lead_<id>`. Kirvano
// echoes the UTMs in the sale webhook, so the sale finds the lead even when the
// buyer checks out with a different email/phone. Existing utm_content is kept.

export const LEAD_TAG_PREFIX = "lead_";
const AB_LEAD_SUFFIX = /\|hw_ab_lead=([A-Za-z0-9_-]+)$/;

const KIRVANO_URL = /https?:\/\/[^\s]*kirvano\.com[^\s]*/gi;

export function tagKirvanoLinks(text: string, leadId: string, slug?: string | null): string {
  return text.replace(KIRVANO_URL, (raw) => {
    const trail = raw.match(/[.,;:!?)\]]+$/)?.[0] ?? ""; // punctuation after the link in prose
    const link = trail ? raw.slice(0, -trail.length) : raw;
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return raw;
    }
    if (!url.searchParams.get("utm_content")) url.searchParams.set("utm_content", LEAD_TAG_PREFIX + leadId);
    if (slug) return tagLiveOrigin(url.toString(), { slug, leadId }) + trail;
    return url.toString() + trail;
  });
}

/** The lead id from a sale's utm_content, if it was tagged by tagKirvanoLinks. */
export function leadIdFromUtm(utmContent: string | null | undefined): string | null {
  const experimentLead = utmContent?.match(AB_LEAD_SUFFIX)?.[1];
  if (experimentLead) return experimentLead;
  return utmContent?.startsWith(LEAD_TAG_PREFIX) ? utmContent.slice(LEAD_TAG_PREFIX.length) || null : null;
}

/** Only an identified experiment participant gets this tag. Keep acquisition content intact. */
export function tagAbKirvanoCheckout(link: string, leadId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(leadId)) return link;
  let url: URL;
  try { url = new URL(link); } catch { return link; }
  if (!["https:", "http:"].includes(url.protocol)) return link;
  if (url.hostname !== "kirvano.com" && !url.hostname.endsWith(".kirvano.com")) return link;
  const content = (url.searchParams.get("utm_content") ?? "").replace(AB_LEAD_SUFFIX, "");
  url.searchParams.set("utm_content", `${content}|hw_ab_lead=${leadId}`);
  return url.toString();
}

/** Day of the live in São Paulo as DDMM (16/11 -> "1611"). */
export function liveDayTag(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return pick("day") + pick("month");
}

/**
 * Tags a checkout opened from a room with the room and the day of the live, so a sale
 * shows which edition it came from (recurring rooms reuse the same link every day).
 * utm_campaign and utm_term get "<slug>-<DDMM>" (ex.: aula-10h-1611); utm_term keeps the
 * day even when the link or the lead already brings its own utm_campaign.
 * Never overwrites a UTM that is already in the link.
 */
export function tagLiveOrigin(link: string, opts: { slug: string; leadId: string; now?: Date }): string {
  let url: URL;
  try { url = new URL(link); } catch { return link; }
  if (!["https:", "http:"].includes(url.protocol)) return link;
  const edition = `${opts.slug}-${liveDayTag(opts.now)}`;
  const fill: Array<[string, string]> = [
    ["utm_source", "lives"],
    ["utm_medium", opts.slug],
    ["utm_campaign", edition],
    ["utm_term", edition],
    ["utm_content", LEAD_TAG_PREFIX + opts.leadId]
  ];
  for (const [key, value] of fill) if (!url.searchParams.get(key)) url.searchParams.set(key, value);
  return url.toString();
}
