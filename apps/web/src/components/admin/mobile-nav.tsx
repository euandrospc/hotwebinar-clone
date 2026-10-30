"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Below md the sidebar is hidden; this top bar opens it as a drawer.
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex items-center border-b bg-card px-3 py-2 md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Same width as the sidebar, whose own right border is the drawer edge. */}
          <div className="relative flex h-full w-60 flex-col bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-3 z-10"
            >
              <X className="h-5 w-5" />
            </Button>
            {children}
          </div>
          <button type="button" className="flex-1 bg-black/50" aria-label="Fechar menu" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
