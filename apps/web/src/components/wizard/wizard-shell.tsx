"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import styles from "./wizard.module.css";
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
  type AppIcon
} from "@/components/icons";

interface StepDef {
  num: number;
  href: (id: string) => string;
  matchPath: (pathname: string, id: string) => boolean;
  label: string;
  Icon: AppIcon;
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
  webinarTitle?: string;
}

export function WizardShell({ webinarId, children, webinarTitle }: WizardShellProps) {
  const pathname = usePathname() ?? "";
  const stepsRef = useRef<HTMLElement>(null);

  const activeIndex = STEPS.findIndex((s) => s.matchPath(pathname, webinarId));

  useEffect(() => {
    const container = stepsRef.current;
    const activeStep = container?.querySelector<HTMLAnchorElement>('[aria-current="step"]');
    if (!container || !activeStep) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeStep.getBoundingClientRect();
    if (activeRect.left >= containerRect.left && activeRect.right <= containerRect.right) return;

    const centeredLeft = container.scrollLeft + activeRect.left - containerRect.left
      - (container.clientWidth - activeRect.width) / 2;
    container.scrollTo({
      left: Math.max(0, Math.min(container.scrollWidth - container.clientWidth, centeredLeft)),
      behavior: "auto"
    });
  }, [activeIndex, webinarId]);

  return (
    <AdminPage className={styles.shell}>
      <AdminPageHeader title={webinarTitle || "Configurar webinar"} description="Configure a experiência do seu público, do acesso à oferta."
        back={{ href: "/dashboard/webinars", label: "Webinars" }} />
      <nav ref={stepsRef} aria-label="Etapas do webinar" className={styles.steps}>
        <ol className={styles.stepList}>
          {STEPS.map((step, index) => <li key={step.num}>
            <Link href={step.href(webinarId)} className={styles.step} aria-current={index === activeIndex ? "step" : undefined}>
              <step.Icon aria-hidden="true" />
              <span>{step.label}</span><span className={styles.stepNumber}>{String(step.num).padStart(2, "0")}</span>
            </Link>
          </li>)}
        </ol>
      </nav>
      <div className={styles.content}>{children}</div>
    </AdminPage>
  );
}
