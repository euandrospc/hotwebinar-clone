"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TvMinimalPlay, MessageCircle, Video, Menu } from "@/components/icons";
import type { AppIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: AppIcon; match: (path: string) => boolean };

const under = (path: string, href: string) => path === href || path.startsWith(href + "/");
// Screens reached from "Mais" keep that tab highlighted.
const MORE_ROUTES = ["/dashboard/mais", "/dashboard/ab-tests", "/dashboard/atendentes", "/dashboard/consumo", "/dashboard/settings"];

const TABS: Tab[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard, match: (p) => p === "/dashboard" || p === "/dashboard/online" },
  { href: "/dashboard/webinars", label: "Webinars", icon: TvMinimalPlay, match: (p) => under(p, "/dashboard/webinars") },
  { href: "/atendimento", label: "Atendimento", icon: MessageCircle, match: (p) => under(p, "/atendimento") },
  { href: "/dashboard/videos", label: "Vídeos", icon: Video, match: (p) => under(p, "/dashboard/videos") },
  { href: "/dashboard/mais", label: "Mais", icon: Menu, match: (p) => MORE_ROUTES.some((r) => under(p, r)) }
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#1E241F] bg-[#0C0E0C]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur-xl md:hidden">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco">
            <span className={cn("flex h-[30px] w-14 items-center justify-center rounded-[15px] transition-colors motion-reduce:transition-none", active ? "bg-palco/15" : "group-active:bg-white/5")}>
              <Icon aria-hidden="true" className={cn("size-[21px]", active ? "text-palco" : "text-[#7C867E]")} />
            </span>
            <span className={cn("max-w-full truncate text-[11px] font-semibold", active ? "text-palco" : "text-[#7C867E]")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
