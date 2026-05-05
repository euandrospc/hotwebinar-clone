import crypto from "node:crypto";

function getSecret(): string {
  const v = process.env.LEAD_SESSION_SECRET;
  if (!v || v.length < 16) throw new Error("Missing or too-short env: LEAD_SESSION_SECRET");
  return v;
}

function sign(leadId: string): string {
  return crypto.createHmac("sha256", getSecret()).update(leadId).digest("hex").slice(0, 32);
}

export function signLeadCookie(leadId: string): string {
  return `${sign(leadId)}.${leadId}`;
}

export function verifyLeadCookie(cookie: string | null | undefined): string | null {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const sig = cookie.slice(0, dot);
  const leadId = cookie.slice(dot + 1);
  if (sig.length !== 32 || leadId.length === 0) return null;
  const expected = sign(leadId);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return leadId;
}
