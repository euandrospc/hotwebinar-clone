// Tags Kirvano checkout links sent to a lead with `utm_content=lead_<id>`. Kirvano
// echoes the UTMs in the sale webhook, so the sale finds the lead even when the
// buyer checks out with a different email/phone. Existing utm_content is kept.

export const LEAD_TAG_PREFIX = "lead_";

const KIRVANO_URL = /https?:\/\/[^\s]*kirvano\.com[^\s]*/gi;

export function tagKirvanoLinks(text: string, leadId: string): string {
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
    return url.toString() + trail;
  });
}

/** The lead id from a sale's utm_content, if it was tagged by tagKirvanoLinks. */
export function leadIdFromUtm(utmContent: string | null | undefined): string | null {
  return utmContent?.startsWith(LEAD_TAG_PREFIX) ? utmContent.slice(LEAD_TAG_PREFIX.length) || null : null;
}
