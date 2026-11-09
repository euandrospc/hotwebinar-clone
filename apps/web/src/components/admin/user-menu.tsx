"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Bolt, ChevronUp, LogOut, Moon, Sun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateAvatar } from "@/lib/generate-avatar";
import { cn } from "@/lib/utils";
import { useAdminLogout } from "./use-admin-logout";

const menuItemClassName = "rounded-lg py-2.5 text-[13px] text-[#52635A] transition-colors duration-150 focus:bg-[#EFF5EA] focus:text-[#064B3C] active:bg-[#E8F1E1] motion-reduce:transition-none dark:text-muted-foreground dark:focus:bg-[#143E31] dark:focus:text-[#C5E99D] dark:active:bg-[#1A4A3A]";

export function UserMenu({ name, email, collapsed = false }: { name: string; email: string; collapsed?: boolean }) {
  const avatar = generateAvatar(name || email);
  const { logout, pending } = useAdminLogout();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("group/account h-11 w-full min-w-0 justify-start gap-2 rounded-lg px-1.5 text-left transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#F3F7EF] active:scale-[0.985] active:bg-[#EAF2E3] focus-visible:ring-[#83B94D]/60 focus-visible:ring-offset-2 data-[state=open]:bg-[#F0F5EB] motion-reduce:transition-none motion-reduce:active:scale-100 dark:hover:bg-[#122C23] dark:active:bg-[#17392D] dark:data-[state=open]:bg-[#143326]", collapsed && "justify-center px-0")} aria-label={`Abrir menu da conta de ${name}`} title={collapsed ? name : undefined}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3F8EA] to-[#DDEBCF] text-[10px] font-semibold text-[#064B3C] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(28,58,36,0.04)] ring-1 ring-inset ring-[#064B3C]/[0.07] dark:from-[#24513D] dark:to-[#143326] dark:text-[#C5E99D] dark:shadow-[inset_0_1px_0_rgba(197,233,157,0.08)] dark:ring-[#C5E99D]/10" aria-hidden="true">{avatar?.letters ?? name.slice(0, 2).toUpperCase()}</span>
          {!collapsed && <>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#17231F] dark:text-foreground">{name}</span><span className="mt-0.5 block truncate text-[10px] font-normal text-[#7C8981] dark:text-muted-foreground">{email}</span></span>
            <ChevronUp aria-hidden="true" className="h-3 w-3 shrink-0 text-[#7C8981] transition-[transform,color] duration-200 group-hover/account:text-[#064B3C] group-data-[state=open]/account:rotate-180 motion-reduce:transition-none dark:group-hover/account:text-[#C5E99D]" />
          </>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={8} collisionPadding={8} className="w-64 max-w-[calc(100vw-1rem)] rounded-xl border-[#E3E9E3] bg-white/95 p-2 shadow-[0_16px_48px_-16px_rgba(18,42,28,0.25),0_4px_12px_-4px_rgba(18,42,28,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111815]/95 dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]">
        <DropdownMenuLabel className="px-2 py-2"><p className="truncate font-medium">{name}</p><p className="mt-1 truncate text-xs font-normal text-muted-foreground">{email}</p></DropdownMenuLabel>
        <DropdownMenuItem asChild className={menuItemClassName}><Link href="/dashboard/settings"><Bolt />Configurações da conta</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")} className={menuItemClassName}>
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          {isDark ? "Mudar para claro" : "Mudar para escuro"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout} disabled={pending} className={menuItemClassName}><LogOut />{pending ? "Saindo…" : "Sair da conta"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
