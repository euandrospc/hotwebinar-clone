"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { SidebarControls } from "./sidebar-controls";
import styles from "./sidebar.module.css";

const STORAGE_KEY = "admin-sidebar-collapsed";

export function DesktopSidebar({ name, email }: { name: string; email: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "true"); } catch { /* Storage is optional. */ }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Keep the in-memory preference. */ }
  }

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 64 : 208 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`${styles.surface} my-3 ml-3 hidden min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border md:flex`}
    >
      <Sidebar collapsed={collapsed} navigationId="desktop-sidebar-navigation" onToggle={toggle} />
      <SidebarControls name={name} email={email} collapsed={collapsed} />
    </motion.div>
  );
}
