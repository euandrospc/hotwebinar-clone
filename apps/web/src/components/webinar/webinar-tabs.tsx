"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  webinarId: string;
}

const TABS = [
  { label: "Editor", suffix: "/step-1" },
  { label: "Leads", suffix: "/leads" },
  { label: "Mapa", suffix: "/leads-map" },
  { label: "Métricas", suffix: "/metrics" },
  { label: "Tempo real", suffix: "/realtime" },
  { label: "Webhooks", suffix: "/webhooks" }
] as const;

export function WebinarTabs({ webinarId }: Props) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/webinars/${webinarId}`;
  return (
    <nav aria-label="Navegação do webinar" className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active =
          pathname === href ||
          (t.suffix === "/step-1" && pathname.includes(`${base}/step-`));
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors",
              active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
