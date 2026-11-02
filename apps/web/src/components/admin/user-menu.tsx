"use client";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "@/components/icons";
import { useRouter } from "next/navigation";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { generateAvatar } from "@/lib/generate-avatar";
import { ThemeToggle } from "@/components/theme-toggle";

export function UserMenu({ name, email, collapsed = false }: { name: string; email: string; collapsed?: boolean }) {
  const router = useRouter();
  const avatar = generateAvatar(name || email);
  async function logout() {
    await signOut();
    router.push(ADMIN_LOGIN_PATH);
  }
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3", collapsed && "flex-col px-2")} title={collapsed ? `${name} · ${email}` : undefined}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ backgroundColor: avatar?.backgroundColor ?? "hsl(var(--destructive))", color: avatar?.textColor ?? "white" }}
        aria-hidden
      >
        {avatar?.letters ?? name.slice(0, 2).toUpperCase()}
      </div>
      {!collapsed && <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>}
      <div className={cn("flex w-full items-center justify-end", collapsed && "flex-col")}><ThemeToggle />
      <Button size="icon" variant="ghost" onClick={logout} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button></div>
    </div>
  );
}
