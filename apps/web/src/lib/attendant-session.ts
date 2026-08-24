import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasRole, ATTENDANT_ROLES } from "@/lib/roles";

export async function requireAttendant() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !hasRole((session.user as { role?: string }).role, ATTENDANT_ROLES)) return null;
  return session;
}
