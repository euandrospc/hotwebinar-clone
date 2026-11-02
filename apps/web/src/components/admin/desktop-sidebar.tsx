"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

export function DesktopSidebar({ name, email }: { name: string; email: string }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === "true"); } catch { /* Storage is optional. */ }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* Keep the in-memory preference. */ }
  }

  return (
    <div className={cn(
      "my-3 ml-3 hidden min-h-0 shrink-0 flex-col rounded-xl border bg-card shadow-sm transition-[width] duration-200 motion-reduce:transition-none md:flex",
      collapsed ? "w-[72px]" : "w-60"
    )}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <UserMenu name={name} email={email} collapsed={collapsed} />
    </div>
  );
}
