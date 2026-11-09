"use client";

import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

export function SidebarControls({ name, email, collapsed = false }: { name: string; email: string; collapsed?: boolean }) {
  return (
    <div className={cn("mx-2.5 shrink-0 pb-2 pt-1.5", collapsed && "mx-2")}>
      <UserMenu name={name} email={email} collapsed={collapsed} />
    </div>
  );
}
