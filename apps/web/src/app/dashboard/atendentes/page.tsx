import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { listAttendantsAction } from "@/server/actions/attendants";
import { AttendantsManager } from "./_components/attendants-manager";

export const dynamic = "force-dynamic";

export default async function AtendentesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=/dashboard/atendentes`);
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) redirect("/dashboard");

  const attendants = await listAttendantsAction();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Atendentes</h1>
      <p className="mt-2 text-muted-foreground">Crie e gerencie contas de atendentes do chat.</p>
      <div className="mt-8">
        <AttendantsManager
          initial={attendants.map((a) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            role: a.role,
            createdAt: a.createdAt.toISOString()
          }))}
        />
      </div>
    </div>
  );
}
