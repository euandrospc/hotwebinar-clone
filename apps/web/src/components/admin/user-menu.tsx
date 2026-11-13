"use client";

import Link from "next/link";
import { Bolt, ChevronUp, LogOut } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateAvatar } from "@/lib/generate-avatar";
import { cn } from "@/lib/utils";
import { useAdminLogout } from "./use-admin-logout";

const menuItemClassName = "rounded-lg py-2.5 text-[13px] text-[#52635A] transition-colors duration-150 focus:bg-[#EFF5EA] focus:text-[#064B3C] active:bg-[#E8F1E1] motion-reduce:transition-none dark:text-muted-foreground dark:focus:bg-[#143E31] dark:focus:text-[#C5E99D] dark:active:bg-[#1A4A3A]";

export function UserMenu({ name, email, collapsed = false }: { name: string; email: string; collapsed?: boolean }) {
  const avatar = generateAvatar(name || email);
  const { logout, pending } = useAdminLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("group/account h-14 w-full min-w-0 justify-start gap-3 rounded-lg px-1 text-left transition-[background-color,transform] duration-200 hover:bg-white/[0.04] active:scale-[0.985] focus-visible:ring-palco/60 focus-visible:ring-offset-0 data-[state=open]:bg-white/[0.06] motion-reduce:transition-none motion-reduce:active:scale-100", collapsed && "justify-center px-0")} aria-label={`Abrir menu da conta de ${name}`} title={collapsed ? name : undefined}>
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-palco/[0.12] text-xs font-bold text-palco" aria-hidden="true">{avatar?.letters ?? name.slice(0, 2).toUpperCase()}</span>
          {!collapsed && <>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-neutral-100">{name}</span><span className="mt-0.5 block truncate text-xs font-normal text-neutral-500">{email}</span></span>
            <ChevronUp aria-hidden="true" className="size-4 shrink-0 text-neutral-500 transition-[transform,color] duration-200 group-hover/account:text-neutral-100 group-data-[state=open]/account:rotate-180 motion-reduce:transition-none" />
          </>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={8} collisionPadding={8} className="w-64 max-w-[calc(100vw-1rem)] rounded-xl border-[#E3E9E3] bg-white/95 p-2 shadow-[0_16px_48px_-16px_rgba(18,42,28,0.25),0_4px_12px_-4px_rgba(18,42,28,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111815]/95 dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]">
        <DropdownMenuLabel className="px-2 py-2"><p className="truncate font-medium">{name}</p><p className="mt-1 truncate text-xs font-normal text-muted-foreground">{email}</p></DropdownMenuLabel>
        <DropdownMenuItem asChild className={menuItemClassName}><Link href="/dashboard/settings"><Bolt />Configurações da conta</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={logout} disabled={pending} className={menuItemClassName}><LogOut />{pending ? "Saindo…" : "Sair da conta"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
