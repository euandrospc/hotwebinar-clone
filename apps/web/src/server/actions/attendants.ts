"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { createAttendant, listAttendants, setAttendantDisabled } from "@/lib/attendants";

type Result = { ok: true } | { error: string };

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) throw new Error("Forbidden");
  return session;
}

export async function listAttendantsAction() {
  await requireAdmin();
  return listAttendants();
}

export async function createAttendantAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result> {
  await requireAdmin();
  if (!input.name.trim() || !input.email.trim() || input.password.length < 8) {
    return { error: "invalid_input" };
  }
  try {
    await createAttendant(input);
  } catch {
    return { error: "create_failed" };
  }
  revalidatePath("/dashboard/atendentes");
  return { ok: true };
}

export async function toggleAttendantAction(userId: string, disabled: boolean): Promise<Result> {
  await requireAdmin();
  await setAttendantDisabled(userId, disabled);
  revalidatePath("/dashboard/atendentes");
  return { ok: true };
}
