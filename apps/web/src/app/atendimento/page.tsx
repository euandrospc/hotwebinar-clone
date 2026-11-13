import type { Metadata } from "next";
import { attendanceToday } from "@/lib/attendance-range";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasRole, ATTENDANT_ROLES } from "@/lib/roles";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { getAdminBrandName } from "@/server/admin-brand";
import { ForceDarkTheme } from "@/components/admin/force-dark-theme";
import { palcoFonts } from "@/components/admin/palco-fonts";
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
  return (
    <div className={`${palcoFonts} dark font-palco [color-scheme:dark] [--background:120_9%_4%] [--border:125_9%_13%] [--card:120_9%_5%] [--foreground:120_14%_96%] [--muted-foreground:133_4%_51%] [--muted:125_9%_11%] [--popover:120_12%_7%] [--primary:147_75%_52%] [--primary-foreground:147_60%_5%] [--ring:147_75%_52%]`}>
      <ForceDarkTheme />
      <Inbox attendantName={session.user.name ?? "Atendente"} attendantId={session.user.id} initialDate={attendanceToday()} isAdmin={(session.user as { role?: string }).role === "admin"} />
    </div>
  );
}
