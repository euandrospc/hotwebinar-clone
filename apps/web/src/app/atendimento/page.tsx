import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasRole, ATTENDANT_ROLES } from "@/lib/roles";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { Inbox } from "./_components/inbox";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=/atendimento`);
  if (!hasRole((session.user as { role?: string }).role, ATTENDANT_ROLES)) redirect(ADMIN_LOGIN_PATH);
  return <Inbox attendantName={session.user.name ?? "Atendente"} />;
}
