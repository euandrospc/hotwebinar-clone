"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Pencil, Radio, Users, Webhook, Zap } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Props {
  webinarId: string;
}

const TABS = [
  { label: "Editor", suffix: "/step-1", icon: Pencil },
  { label: "Leads", suffix: "/leads", icon: Users },
  { label: "Métricas", suffix: "/metrics", icon: BarChart3 },
  { label: "Tempo real", suffix: "/realtime", icon: Radio },
  { label: "Agente IA", suffix: "/chat-ai", icon: Zap },
  { label: "Webhooks", suffix: "/webhooks", icon: Webhook }
] as const;

export function WebinarTabs({ webinarId }: Props) {
  const pathname = usePathname() ?? "";
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const revealActive = () => {
      const bounds = nav.getBoundingClientRect();
      const target = active.getBoundingClientRect();
      if (target.left < bounds.left || target.right > bounds.right) nav.scrollLeft += target.left - bounds.left - (bounds.width - target.width) / 2;
    };
    revealActive();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(revealActive);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);
  const base = `/dashboard/webinars/${webinarId}`;
  return (
    <nav ref={navigation} data-webinar-navigation aria-label="Navegação do webinar" className="flex w-max min-w-0 max-w-full shrink-0 items-center gap-1 self-start overflow-x-auto rounded-xl border border-[#1E241F] bg-[#0C0E0C] p-[5px] font-palco [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((t) => {
        const Icon = t.icon;
        const href = `${base}${t.suffix}`;
        const active =
          pathname === href ||
          (t.suffix === "/step-1" && (pathname.includes(`${base}/step-`) || pathname === `${base}/integrations` || pathname === `${base}/sales-preview`));
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group inline-flex h-8 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none",
              active ? "border-palco/25 bg-palco/[0.08] text-neutral-100" : "border-transparent text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
            )}
          >
            <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", active ? "text-palco" : "text-neutral-500 group-hover:text-neutral-300")} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
