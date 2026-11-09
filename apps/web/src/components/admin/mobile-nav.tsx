"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { SidebarControls } from "./sidebar-controls";
import styles from "./sidebar.module.css";

export function MobileNav({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button variant="outline" size="icon" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 h-11 w-11 rounded-xl border-[#E3E9E3] bg-white text-[#064B3C] shadow-[0_2px_12px_rgba(16,40,30,0.10)] hover:bg-[#F7F9F6] dark:border-border dark:bg-card dark:text-foreground md:hidden" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content asChild>
          <motion.div initial={reduceMotion ? false : { x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`${styles.surface} fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex w-[244px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border outline-none`}
            onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
            <Dialog.Title className="sr-only">Navegação Bravy Lives</Dialog.Title>
            <Dialog.Description className="sr-only">Acesse seus webinars, vídeos, atendimento e configurações.</Dialog.Description>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar menu" className="absolute right-2 top-4 z-10 h-8 w-8 rounded-lg text-muted-foreground"><X className="h-4 w-4" /></Button></Dialog.Close>
            <Sidebar />
            <SidebarControls name={name} email={email} />
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
