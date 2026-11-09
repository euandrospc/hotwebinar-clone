import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { DesktopSidebar } from "./desktop-sidebar";
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
  const user = { name: session.user.name ?? session.user.email, email: session.user.email };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8F9F7] text-[#17231F] dark:bg-background dark:text-foreground">
      <a href="#main-content" className="sr-only rounded-md bg-[#064B3C] px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">Ir para o conteúdo</a>
      <DesktopSidebar {...user} />
      <MobileNav {...user} />
      <main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain outline-none">{children}</main>
    </div>
  );
}
