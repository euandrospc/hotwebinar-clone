import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { hasRole, ADMIN_ROLES } from "@/lib/roles";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";

export async function AdminShell({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  const role = (session.user as { role?: string }).role;
  if (role === "attendant") redirect("/atendimento");
  if (role === "disabled") redirect(ADMIN_LOGIN_PATH);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <MobileNav>
        <Sidebar />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </MobileNav>
      <div className="hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <Sidebar />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/30">{children}</main>
    </div>
  );
}
