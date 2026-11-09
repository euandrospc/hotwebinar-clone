"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { signOut } from "@/lib/auth-client";

export function useAdminLogout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      const result = await signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace(ADMIN_LOGIN_PATH);
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  return { logout, pending };
}
