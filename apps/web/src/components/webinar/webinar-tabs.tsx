"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./webinar-operations.module.css";

interface Props {
  webinarId: string;
}

const TABS = [
  { label: "Editor", suffix: "/step-1" },
  { label: "Leads", suffix: "/leads" },
  { label: "Mapa", suffix: "/leads-map" },
  { label: "Métricas", suffix: "/metrics" },
  { label: "Tempo real", suffix: "/realtime" },
  { label: "Agente IA", suffix: "/chat-ai" },
  { label: "Webhooks", suffix: "/webhooks" }
] as const;

export function WebinarTabs({ webinarId }: Props) {
  const pathname = usePathname() ?? "";
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const bounds = nav.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    if (target.left < bounds.left || target.right > bounds.right) nav.scrollLeft += target.left - bounds.left - (bounds.width - target.width) / 2;
  }, [pathname]);
  const base = `/dashboard/webinars/${webinarId}`;
  return (
    <nav ref={navigation} aria-label="Navegação do webinar" className={styles.navigation}>
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active =
          pathname === href ||
          (t.suffix === "/step-1" && (pathname.includes(`${base}/step-`) || pathname === `${base}/integrations` || pathname === `${base}/sales-preview`));
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={styles.navLink}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
