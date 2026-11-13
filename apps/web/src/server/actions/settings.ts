"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { describeUserAgent, formatLastActive } from "@/lib/account-sessions";
import { normalizePublicIp } from "@/lib/geoip";
import {
  accountSettingsSchema,
  type AccountSettingsInput
} from "@/lib/validations/settings";

type Result = { ok: true } | { error: { field?: string; message: string } };

const DEFAULTS = {
  defaultLanguage: "pt-BR",
  defaultTimezone: "America/Sao_Paulo",
  brandName: ""
};

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getAccountSettings(): Promise<typeof DEFAULTS> {
  const session = await requireSession();
  const row = await prisma.accountSettings.findUnique({ where: { userId: session.user.id } });
  if (!row) return DEFAULTS;
  return {
    defaultLanguage: row.defaultLanguage,
    defaultTimezone: row.defaultTimezone,
    brandName: row.brandName ?? ""
  };
}

export async function upsertAccountSettings(input: AccountSettingsInput): Promise<Result> {
  const session = await requireSession();
  const parsed = accountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.accountSettings.upsert({
    where: { userId: session.user.id },
    update: {
      defaultLanguage: parsed.data.defaultLanguage,
      defaultTimezone: parsed.data.defaultTimezone,
      brandName: parsed.data.brandName || null
    },
    create: {
      userId: session.user.id,
      defaultLanguage: parsed.data.defaultLanguage,
      defaultTimezone: parsed.data.defaultTimezone,
      brandName: parsed.data.brandName || null
    }
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export type AccountSession = {
  id: string;
  current: boolean;
  label: string;
  mobile: boolean;
  location: string | null;
  lastActive: string;
};

/** Unexpired sessions of the signed-in user, current first, with cached IP location. */
export async function listAccountSessions(): Promise<AccountSession[]> {
  const session = await requireSession();
  const rows = await prisma.session.findMany({
    where: { userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ipAddress: true, userAgent: true, updatedAt: true }
  });
  const ips = [...new Set(rows.map(row => normalizePublicIp(row.ipAddress)).filter((ip): ip is string => !!ip))];
  const lookups = ips.length
    ? await prisma.geoIpLookup.findMany({ where: { ip: { in: ips }, status: "SUCCESS" }, select: { ip: true, city: true, region: true, country: true } })
    : [];
  const missing = ips.filter(ip => !lookups.some(l => l.ip === ip));
  // Unknown IPs go through the shared, rate-limited GeoIP worker; never call the provider here.
  if (missing.length) await prisma.geoIpLookup.createMany({ data: missing.map(ip => ({ ip })), skipDuplicates: true }).catch(() => undefined);
  const now = new Date();
  return rows
    .map(row => {
      const current = row.id === session.session.id;
      const geo = lookups.find(l => l.ip === normalizePublicIp(row.ipAddress));
      const place = geo ? [geo.city ?? geo.region, geo.country].filter(Boolean).join(", ") : "";
      return {
        id: row.id,
        current,
        ...describeUserAgent(row.userAgent),
        location: place || null,
        lastActive: current ? "agora" : formatLastActive(row.updatedAt, now)
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function revokeAccountSession(id: string): Promise<Result> {
  const session = await requireSession();
  if (typeof id !== "string" || !id || id === session.session.id) {
    return { error: { message: "Use “Sair” para encerrar a sessão deste dispositivo." } };
  }
  const { count } = await prisma.session.deleteMany({ where: { id, userId: session.user.id } });
  if (!count) return { error: { message: "Sessão não encontrada ou já encerrada." } };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getWebinarSalesWebhookSecret(webinarId: string): Promise<string | null> {
  const session = await requireSession();
  const row = await prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { ownerId: true, salesWebhookSecret: true }
  });
  if (!canAccessWebinar(session, row)) return null;
  return row.salesWebhookSecret;
}

export async function regenerateWebinarSalesWebhookSecret(
  webinarId: string
): Promise<{ secret: string } | { error: string }> {
  const session = await requireSession();
  const w = await prisma.webinar.findUnique({ where: { id: webinarId }, select: { ownerId: true } });
  if (!canAccessWebinar(session, w)) return { error: "not_found" };
  const secret = generateSecret();
  await prisma.webinar.update({ where: { id: webinarId }, data: { salesWebhookSecret: secret } });
  revalidatePath(`/dashboard/webinars/${webinarId}/integrations`);
  return { secret };
}
