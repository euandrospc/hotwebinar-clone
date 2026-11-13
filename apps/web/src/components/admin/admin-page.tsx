import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { cn } from "@/lib/utils";
import styles from "./admin-page.module.css";

/** Shared v2 framing for operational screens; leaves each feature's behavior intact. */
export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-admin-page="v2" className={cn(styles.page, className)}>{children}</div>;
}

export function AdminPageHeader({ title, description, actions, back, className }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return <header className={cn(styles.header, className)}>
    <div className={styles.heading}>
      {back && <Link href={back.href} className={styles.back}><ArrowLeft aria-hidden="true" />{back.label}</Link>}
      <h1 className={styles.title}>{title}</h1>
      {description && <div className={styles.description}>{description}</div>}
    </div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </header>;
}

export function AdminSurface({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn(styles.surface, padded && styles.padded, className)}>{children}</div>;
}

export function AdminEmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return <div className={styles.empty}>
    {icon && <span className={styles.emptyIcon} aria-hidden="true">{icon}</span>}
    <p className={styles.emptyTitle}>{title}</p>
    {description && <p className={styles.emptyDescription}>{description}</p>}
    {action && <div className={styles.emptyAction}>{action}</div>}
  </div>;
}
