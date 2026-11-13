"use client";

import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

export function SidebarControls({ name, email, collapsed = false }: { name: string; email: string; collapsed?: boolean }) {
  return (
    <div className={cn("mx-4 shrink-0 border-t border-[#1a1f1b] pb-4 pt-3", collapsed && "mx-2")}>
      <UserMenu name={name} email={email} collapsed={collapsed} />
    </div>
  );
}
