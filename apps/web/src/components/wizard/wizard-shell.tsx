import { headers } from "next/headers";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Flag,
  MonitorPlay,
  LogIn,
  Video,
  Gift,
  MessageCircle,
  DollarSign,
  Eye,
  Plug2,
  type LucideIcon
} from "lucide-react";

interface StepDef {
  num: number;
  href: (id: string) => string;
  matchPath: (pathname: string, id: string) => boolean;
  label: string;
  Icon: LucideIcon;
}

const STEPS: ReadonlyArray<StepDef> = [
  { num: 1, label: "Início", Icon: Flag, href: (id) => `/dashboard/webinars/${id}/step-1`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-1` },
  { num: 2, label: "Webinar", Icon: MonitorPlay, href: (id) => `/dashboard/webinars/${id}/step-2`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-2` },
  { num: 3, label: "Login", Icon: LogIn, href: (id) => `/dashboard/webinars/${id}/step-3`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-3` },
  { num: 4, label: "Vídeo", Icon: Video, href: (id) => `/dashboard/webinars/${id}/step-4`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-4` },
  { num: 5, label: "Oferta", Icon: Gift, href: (id) => `/dashboard/webinars/${id}/step-5`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-5` },
  { num: 6, label: "Chat", Icon: MessageCircle, href: (id) => `/dashboard/webinars/${id}/step-6`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-6` },
  { num: 7, label: "Vendas", Icon: DollarSign, href: (id) => `/dashboard/webinars/${id}/step-7`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-7` },
  { num: 8, label: "Audiência", Icon: Eye, href: (id) => `/dashboard/webinars/${id}/step-8`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-8` },
  { num: 9, label: "Integrações", Icon: Plug2, href: (id) => `/dashboard/webinars/${id}/integrations`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/integrations` }
];

export interface WizardShellProps {
  webinarId: string;
  children: React.ReactNode;
}

export async function WizardShell({ webinarId, children }: WizardShellProps) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "";

  const activeIndex = STEPS.findIndex((s) => s.matchPath(pathname, webinarId));

  return (
    <div className="container mx-auto py-8">
      <nav className="overflow-x-auto pb-4">
        <ol className="flex min-w-max items-end gap-0">
          {STEPS.map((s, i) => {
            const isActive = i === activeIndex;
            const isPast = activeIndex >= 0 && i < activeIndex;
            const iconColor = isActive ? "text-red-600" : isPast ? "text-emerald-600" : "text-gray-400";
            const labelColor = isActive ? "text-red-600 font-semibold" : isPast ? "text-emerald-700" : "text-gray-500";
            const circleColor = isActive ? "bg-emerald-600 text-white" : isPast ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500";
            const lineColor = isPast ? "bg-emerald-600" : "bg-gray-300";
            const showLine = i < STEPS.length - 1;
            return (
              <li key={s.num} className="flex flex-col items-center">
                <Link href={s.href(webinarId)} className="group flex flex-col items-center px-3">
                  <s.Icon className={cn("h-7 w-7 mb-1", iconColor)} />
                  <span className={cn("text-xs", labelColor)}>{s.label}</span>
                </Link>
                <div className="flex items-center">
                  <span
                    className={cn(
                      "z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      circleColor
                    )}
                  >
                    {s.num}
                  </span>
                  {showLine ? (
                    <span className={cn("h-0.5 w-12 sm:w-16", lineColor)} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
