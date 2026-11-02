import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { DesktopSidebar } from "./desktop-sidebar";
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
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/30 md:flex-row">
      <MobileNav>
        <Sidebar />
        <UserMenu name={session.user.name ?? session.user.email} email={session.user.email} />
      </MobileNav>
      <DesktopSidebar name={session.user.name ?? session.user.email} email={session.user.email} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
