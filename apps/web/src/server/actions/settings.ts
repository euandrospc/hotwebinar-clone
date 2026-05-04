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
