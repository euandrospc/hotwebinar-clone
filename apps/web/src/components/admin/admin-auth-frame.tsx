import type { ReactNode } from "react";
import Logo from "@/components/logo";
import { LockKeyhole } from "@/components/icons";
import palette from "./admin-page.module.css";
import styles from "./admin-auth-frame.module.css";

export function AdminAuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className={`${palette.portal} ${styles.page}`}>
    <div className={styles.brand} aria-label="Bravy Lives"><Logo /><span>lives</span></div>
    <section className={styles.card} aria-labelledby="auth-title">
      <span className={styles.icon} aria-hidden="true"><LockKeyhole /></span>
      <header className={styles.heading}><h1 id="auth-title">{title}</h1><p>{description}</p></header>
      {children}
    </section>
    <p className={styles.caption}>Acesso ao painel</p>
  </main>;
}
