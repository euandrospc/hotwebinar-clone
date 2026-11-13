"use client";

import { LogOut } from "@/components/icons";
import { useAdminLogout } from "@/components/admin/use-admin-logout";

export function LogoutButton() {
  const { logout, pending } = useAdminLogout();
  return (
    <button type="button" onClick={logout} disabled={pending}
      className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-red-600/35 text-[15px] font-semibold text-red-400 transition-colors hover:bg-red-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60 motion-reduce:transition-none">
      <LogOut aria-hidden="true" className="size-[17px]" />
      {pending ? "Saindo…" : "Sair da conta"}
    </button>
  );
}
