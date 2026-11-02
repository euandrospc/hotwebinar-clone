"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TvMinimalPlay, Video, Headset, Gauge, Bolt, ChevronLeftIcon, ChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Logo from "../logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/webinars", label: "Webinars", icon: TvMinimalPlay },
  { href: "/dashboard/videos", label: "Vídeos", icon: Video },
  { href: "/dashboard/atendentes", label: "Atendentes", icon: Headset },
  { href: "/dashboard/consumo", label: "Consumo", icon: Gauge },
  { href: "/dashboard/settings", label: "Configurações", icon: Bolt }
];

export function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col">
      <div className={cn("flex h-20 shrink-0 items-center", collapsed ? "justify-center px-2" : "justify-between gap-2 px-4")}>
        {!collapsed && <Logo />}
        {onToggle && <Button variant="ghost" size="icon" onClick={onToggle}
          className="h-8 w-8 shrink-0 text-muted-foreground"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!collapsed} aria-controls="desktop-sidebar-navigation">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </Button>}
      </div>
      <nav id={onToggle ? "desktop-sidebar-navigation" : undefined} aria-label="Menu principal" className={cn("grid gap-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0 py-3",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
