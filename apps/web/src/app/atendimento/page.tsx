import type { Metadata } from "next";
import { attendanceToday } from "@/lib/attendance-range";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasRole, ATTENDANT_ROLES } from "@/lib/roles";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { getAdminBrandName } from "@/server/admin-brand";
import { Inbox } from "./_components/inbox";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Atendimento | ${await getAdminBrandName()}` };
}

export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  const returnTo = leadId ? `/atendimento?${new URLSearchParams({ leadId })}` : "/atendimento";
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=${encodeURIComponent(returnTo)}`);
  if (!hasRole((session.user as { role?: string }).role, ATTENDANT_ROLES)) redirect(ADMIN_LOGIN_PATH);
  return <Inbox attendantName={session.user.name ?? "Atendente"} attendantId={session.user.id} initialDate={attendanceToday()} isAdmin={(session.user as { role?: string }).role === "admin"} />;
}
