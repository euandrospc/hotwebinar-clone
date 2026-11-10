"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Pencil, Radio, Sparkles, Users, Webhook } from "@/components/icons";
import { cn } from "@/lib/utils";
import sidebarStyles from "@/components/admin/sidebar.module.css";
import styles from "./webinar-tabs.module.css";

interface Props {
  webinarId: string;
}

const TABS = [
  { label: "Editor", suffix: "/step-1", icon: Pencil },
  { label: "Leads", suffix: "/leads", icon: Users },
  { label: "Métricas", suffix: "/metrics", icon: BarChart3 },
  { label: "Tempo real", suffix: "/realtime", icon: Radio },
  { label: "Agente IA", suffix: "/chat-ai", icon: Sparkles },
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
    <nav ref={navigation} data-webinar-navigation aria-label="Navegação do webinar" className={cn(styles.navigation, sidebarStyles.surface)}>
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
            className={cn(styles.navLink, active && sidebarStyles.activeItem)}
          >
            <Icon aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
