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
  { label: "Webhooks", suffix: "/webhooks" }
] as const;

export function WebinarTabs({ webinarId }: Props) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/webinars/${webinarId}`;
  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active =
          pathname === href ||
          (t.suffix === "/step-1" && pathname.includes(`${base}/step-`));
        return (
          <Link
            key={t.label}
            href={href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm transition-colors",
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
