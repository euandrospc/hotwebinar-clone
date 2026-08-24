import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

export async function AdminShell({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, ADMIN_ROLES) && role === "attendant") redirect("/atendimento");

  return (
    <div className="flex h-screen">
      <div className="flex h-screen w-60 flex-col border-r bg-card">
        <Sidebar />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </div>
      <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
    </div>
  );
}
