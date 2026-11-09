"use client";

import { useId } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Headset, Info, Sparkles } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardInsights } from "@/lib/dashboard-insights";
import styles from "./dashboard-card.module.css";

export type DashboardSupportData = DashboardInsights["support"];

const number = new Intl.NumberFormat("pt-BR");

function replyTime(seconds: number | null) {
  if (seconds === null) return "—";
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value} s`;
  if (value < 3600) return `${Math.floor(value / 60)} min ${value % 60} s`;
  return `${Math.floor(value / 3600)} h ${Math.floor(value % 3600 / 60)} min`;
}

export function DashboardSupportOverview({ support, demo = false }: { support: DashboardSupportData; webinarId?: string; demo?: boolean }) {
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const channels = [
    { key: "human", title: "Equipe humana", Icon: Headset, data: support.human },
    { key: "ai", title: "Agentes de IA", Icon: Sparkles, data: support.ai }
  ] as const;

  return (
    <section aria-labelledby={titleId} className={`${styles.card} min-w-0`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 id={titleId} className="text-[13px] font-semibold leading-5">Atendimento</h2>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild><button type="button" aria-label="Como o atendimento é contado" className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F1F6EB] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:hover:bg-[#203323]"><Info aria-hidden="true" className="size-3.5" /></button></TooltipTrigger>
              <TooltipContent className="max-w-72 leading-relaxed">Conversas únicas com resposta de cada canal no período. Uma conversa pode aparecer nos dois canais. A primeira resposta considera pares de pergunta e resposta registrados dentro do período.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {demo ? <span className="text-[11px] text-muted-foreground">Atendimentos simulados</span> : <Link href="/atendimento" className="group inline-flex items-center gap-1 rounded-md text-[11px] font-medium text-[#07513D] transition-colors hover:text-[#3C763A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:text-[#B7E779] dark:hover:text-[#D0EBB7]">Ver conversas <ArrowUpRight aria-hidden="true" className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" /></Link>}
      </header>
      <div className="mt-2.5 grid grid-cols-1 divide-y divide-border/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {channels.map(({ key, title, Icon, data }) => (
          <motion.div key={key} initial={false} layout="position" transition={{ duration: reducedMotion ? 0 : 0.2 }} className="py-2.5 first:pt-0 last:pb-0 sm:py-0 sm:first:pr-5 sm:last:pl-5" role="group" aria-label={title}>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-[#F1F7E8] to-[#E4EFD8] text-[#07513D] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:from-[#23432E] dark:to-[#1A3021] dark:text-[#B7E779] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"><Icon aria-hidden="true" className="size-3" /></span>
              <h3 className="text-xs font-medium">{title}</h3>
              {data.replies === 0 && <span className="ml-auto text-[10px] text-muted-foreground">Sem respostas</span>}
            </div>
            <dl className="mt-1.5 grid grid-cols-3 gap-2.5">
              <div><dt className="text-[11px] text-muted-foreground">Conversas</dt><dd className="mt-0.5 text-lg font-semibold leading-6 tracking-tight tabular-nums">{number.format(data.conversations)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Respostas</dt><dd className="mt-0.5 text-lg font-semibold leading-6 tracking-tight tabular-nums">{number.format(data.replies)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">1ª resposta média</dt><dd className="mt-0.5 text-[13px] font-semibold leading-6 tabular-nums" title={data.averageFirstReplySeconds === null ? "Sem amostra de pergunta e resposta no período" : "Tempo médio da primeira resposta"}>{replyTime(data.averageFirstReplySeconds)}</dd></div>
            </dl>
          </motion.div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{support.uniqueConversations > 0 ? `${number.format(support.uniqueConversations)} ${support.uniqueConversations === 1 ? "conversa com mensagens" : "conversas com mensagens"} no período. Uma conversa pode passar pelos dois canais.` : "Nenhuma conversa com mensagens neste período."}</p>
    </section>
  );
}
