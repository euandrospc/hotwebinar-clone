"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { LayoutDashboard, TvMinimalPlay, Video, Headset, MessageSquare, Gauge, Bolt, PanelLeft, Target } from "@/components/icons";
import type { AppIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Logo from "../logo";
import styles from "./sidebar.module.css";

type NavigationItem = { href: string; label: string; icon: AppIcon };
const PRINCIPAL: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/webinars", label: "Webinars", icon: TvMinimalPlay },
  { href: "/dashboard/ab-tests", label: "Teste A/B", icon: Target },
  { href: "/dashboard/videos", label: "Vídeos", icon: Video }
];
const OPERATION: NavigationItem[] = [
  { href: "/atendimento", label: "Atendimento", icon: MessageSquare },
  { href: "/dashboard/atendentes", label: "Atendentes", icon: Headset }
];
const MANAGEMENT: NavigationItem[] = [
  { href: "/dashboard/consumo", label: "Consumo", icon: Gauge },
  { href: "/dashboard/settings", label: "Configurações", icon: Bolt }
];

export function Sidebar({ collapsed = false, navigationId, onToggle }: { collapsed?: boolean; navigationId?: string; onToggle?: () => void }) {
  const pathname = usePathname() ?? "";
  const layoutId = useId();
  const reduceMotion = useReducedMotion();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [focusedHref, setFocusedHref] = useState<string | null>(null);
  const [tooltipHref, setTooltipHref] = useState<string | null>(null);
  const inspectedHref = hoveredHref ?? focusedHref;
  const transition = { duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] as const };
  function items(entries: NavigationItem[]) {
    return entries.map(({ href, label, icon: Icon }) => {
      const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
      const inspected = inspectedHref === href;
      return (
        <Tooltip key={href} open={collapsed && tooltipHref === href} onOpenChange={(open) => setTooltipHref((current) => open ? href : current === href ? null : current)}>
        <TooltipTrigger asChild>
        <Link href={href} aria-label={label} aria-current={active ? "page" : undefined}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") setHoveredHref(href); }}
          onPointerLeave={() => setHoveredHref(null)}
          onFocus={() => setFocusedHref(href)} onBlur={() => setFocusedHref(null)}
          onClick={() => setHoveredHref(null)}
          className={cn(
            styles.link,
            "relative isolate flex h-10 shrink-0 items-center rounded-[10px] px-3 text-[13px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83B94D] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141B17] md:h-[38px]",
            active ? "font-medium text-[#064B3C] dark:text-[#D0EBB7]" : "font-normal text-[#6C7771] hover:text-[#244F37] focus-visible:text-[#244F37] dark:text-[#A0ACA3] dark:hover:text-[#D0EBB7] dark:focus-visible:text-[#D0EBB7]"
          )}>
          {active && <motion.span aria-hidden="true" layoutId={reduceMotion ? undefined : "active-item"} initial={false} transition={transition} className={cn(styles.activeItem, "pointer-events-none absolute inset-0 -z-10 rounded-[10px]")} />}
          <AnimatePresence initial={false}>
            {inspected && !active && <motion.span aria-hidden="true" layoutId={reduceMotion ? undefined : "hover-item"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} className={cn(styles.hoverItem, "pointer-events-none absolute inset-0 -z-10 rounded-[10px]")} />}
          </AnimatePresence>
          <motion.span aria-hidden="true" initial={false} animate={{ scale: inspected && !reduceMotion ? 1.08 : 1 }} transition={transition} className="flex h-[17px] w-[17px] shrink-0 items-center justify-center">
            <Icon className={cn("h-[17px] w-[17px]", active && "text-[#578239] dark:text-[#B2D98D]")} />
          </motion.span>
          <motion.span aria-hidden={collapsed} initial={false} animate={{ opacity: collapsed ? 0 : 1, x: reduceMotion ? 0 : collapsed ? -4 : inspected ? 2 : 0 }} transition={{ ...transition, duration: reduceMotion ? 0 : 0.16 }} className="pointer-events-none absolute left-[39px] right-2.5 truncate">{label}</motion.span>
        </Link>
        </TooltipTrigger>
        {collapsed && <TooltipPortal><TooltipContent side="right" sideOffset={14} className="rounded-lg border-[#E2E9DD] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#244F37] shadow-[0_4px_16px_-4px_rgba(24,48,33,0.16)] dark:border-[#334533] dark:bg-[#19221B] dark:text-[#D0EBB7]">{label}</TooltipContent></TooltipPortal>}
        </Tooltip>
      );
    });
  }
  return (
    <LayoutGroup id={layoutId}>
    <TooltipProvider delayDuration={220} skipDelayDuration={80}>
    <aside className="flex min-h-0 w-full flex-1 flex-col">
      <div className="relative flex h-16 shrink-0 items-center">
        <motion.div initial={false} animate={{ opacity: collapsed ? 0 : 1, x: collapsed && !reduceMotion ? -6 : 0 }} transition={{ ...transition, duration: reduceMotion ? 0 : 0.16 }} className={cn("absolute left-5", collapsed && "pointer-events-none")}>
        <Link href="/dashboard" aria-label="Bravy Lives — Dashboard" aria-hidden={collapsed} tabIndex={collapsed ? -1 : undefined} className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83B94D] focus-visible:ring-offset-4 dark:focus-visible:ring-offset-background">
          <span className="[&_svg]:h-auto [&_svg]:w-[92px] [&_svg]:text-[#064B3C] dark:[&_svg]:text-[#C5E99D]"><Logo /></span>
          <span className="text-xs tracking-wide text-[#6C7771] dark:text-muted-foreground">lives</span>
        </Link>
        </motion.div>
        {onToggle && <motion.div initial={false} animate={{ x: collapsed ? -5 : 0 }} transition={transition} className="absolute right-2.5">
        <Button variant="ghost" size="icon" onClick={onToggle}
          className={cn(styles.toggle, "h-8 w-8 shrink-0 rounded-lg text-[#7C8981] hover:bg-[#EDF4E6] hover:text-[#064B3C] focus-visible:ring-[#83B94D] dark:text-[#A0ACA3] dark:hover:bg-[#263824] dark:hover:text-[#D0EBB7]")}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"} title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!collapsed} aria-controls={navigationId}>
          <PanelLeft className="h-[17px] w-[17px]" />
        </Button>
        </motion.div>}
      </div>
      <motion.nav layoutScroll id={navigationId} aria-label="Menu principal" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2.5 pt-1">
        <div className="shrink-0 space-y-0.5">{items(PRINCIPAL)}{items(OPERATION)}</div>
        <div className="min-h-5 flex-1" />
        <div className="shrink-0 space-y-0.5 pb-2">{items(MANAGEMENT)}</div>
      </motion.nav>
    </aside>
    </TooltipProvider>
    </LayoutGroup>
  );
}
