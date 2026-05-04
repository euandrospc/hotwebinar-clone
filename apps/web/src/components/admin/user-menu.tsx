"use client";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  async function logout() {
    await signOut();
    router.push("/login");
  }
  return (
    <div className="flex items-center gap-3 border-t px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-sm font-bold text-destructive-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={logout} aria-label="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
