"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "db";
import { auth } from "@/lib/auth";
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
  if (!row || row.ownerId !== session.user.id) return null;
  return row.salesWebhookSecret;
}

export async function regenerateWebinarSalesWebhookSecret(
  webinarId: string
): Promise<{ secret: string } | { error: string }> {
  const session = await requireSession();
  const w = await prisma.webinar.findUnique({ where: { id: webinarId }, select: { ownerId: true } });
  if (!w || w.ownerId !== session.user.id) return { error: "not_found" };
  const secret = generateSecret();
  await prisma.webinar.update({ where: { id: webinarId }, data: { salesWebhookSecret: secret } });
  revalidatePath(`/dashboard/webinars/${webinarId}/integrations`);
  return { secret };
}
