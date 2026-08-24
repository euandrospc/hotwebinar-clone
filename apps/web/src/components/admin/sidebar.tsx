"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TvMinimalPlay, Video, Headset, Bolt } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "../logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/webinars", label: "Webinars", icon: TvMinimalPlay },
  { href: "/dashboard/videos", label: "Vídeos", icon: Video },
  { href: "/dashboard/atendentes", label: "Atendentes", icon: Headset },
  { href: "/dashboard/settings", label: "Configurações", icon: Bolt }
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="flex w-60 flex-1 flex-col border-r bg-card">
      <div className="px-6 py-5 text-2xl font-bold text-destructive"><Logo /></div>
      <nav className="grid gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
