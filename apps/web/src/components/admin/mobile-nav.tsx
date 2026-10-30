"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "@/components/icons";
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
          <div data-ui-motion="drawer-enter" className="flex h-full w-64 flex-col border-r bg-card">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            {children}
          </div>
          <button type="button" data-ui-motion="overlay" data-state="open" className="flex-1 bg-black/50" aria-label="Fechar menu" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
