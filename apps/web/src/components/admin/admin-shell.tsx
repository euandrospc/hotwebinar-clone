import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { palcoFonts } from "./palco-fonts";
import { ForceDarkTheme } from "./force-dark-theme";

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
    <div className={`${palcoFonts} dark flex h-dvh overflow-hidden bg-[#0a0c0a] font-palco text-neutral-100 [color-scheme:dark] [--background:120_9%_4%] [--border:125_9%_13%] [--card:120_9%_5%] [--foreground:120_14%_96%] [--muted-foreground:133_4%_51%] [--muted:125_9%_11%] [--popover:120_12%_7%] [--primary:147_75%_52%] [--primary-foreground:147_60%_5%] [--ring:147_75%_52%]`}>
      <ForceDarkTheme />
      <a href="#main-content" className="sr-only rounded-md bg-palco px-3 py-2 text-palco-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">Ir para o conteúdo</a>
      <DesktopSidebar {...user} />
      <MobileTabBar />
      <main id="main-content" tabIndex={-1} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom))] outline-none md:pb-0">{children}</main>
    </div>
  );
}
