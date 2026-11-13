"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight, ChevronRight, Clock, Headset, Info, MessageCircle, Search, Send, Sparkles } from "@/components/icons";
import { AreaChart, type TooltipProps } from "@/components/tremor/area-chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardInsights } from "@/lib/dashboard-insights";
import type { DashboardSupportQueue } from "@/server/dashboard/support-queue";
import card from "./dashboard-card.module.css";
import styles from "./dashboard-support-overview.module.css";

export type DashboardSupportData = DashboardInsights["support"];
type Agent = DashboardSupportData["agents"][number];
type SortKey = "conversations" | "replies" | "averageFirstReplySeconds";
const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const PAGE_SIZE = 5;

function replyTime(seconds: number | null) {
  if (seconds === null) return "—";
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`;
  return `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}min`;
}

function Help({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} className={styles.help}><Info aria-hidden="true" className="size-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-80 text-xs leading-relaxed">{children}</TooltipContent></Tooltip>;
}

function ActivityTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as DashboardSupportData["activity"][number];
  return <div className={styles.chartTooltip}>
    <p className="mb-2 text-muted-foreground">{point.date.split("-").reverse().join("/")} · Brasília</p>
    {payload.map((item) => <div key={item.category} className="flex justify-between gap-6 py-0.5"><span>{item.category}</span><strong className="font-medium tabular-nums">{number.format(item.value)}</strong></div>)}
  </div>;
}

export function DashboardSupportOverview({ support, queue, demo = false }: { support: DashboardSupportData; queue?: DashboardSupportQueue; webinarId?: string; demo?: boolean }) {
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const [kind, setKind] = useState<"all" | "human" | "ai">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "replies", ascending: false });
  const [page, setPage] = useState(0);
  const [chartMode, setChartMode] = useState<"replies" | "incoming">("replies");
  const totalReplies = support.human.replies + support.ai.replies;
  const conversationChange = queue?.previousConversations ? (support.uniqueConversations / queue.previousConversations - 1) * 100 : null;
  const humanShare = totalReplies ? support.human.replies / totalReplies * 100 : 0;
  const aiShare = totalReplies ? support.ai.replies / totalReplies * 100 : 0;
  const agents = useMemo(() => support.agents.filter((agent) =>
    (kind === "all" || (kind === "ai" ? agent.kind === "ai" : agent.kind !== "ai")) &&
    agent.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  ).sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    // Missing response samples always follow measured rows, in either direction.
    if (av === null || bv === null) return av === bv ? a.name.localeCompare(b.name, "pt-BR") : av === null ? 1 : -1;
    return (sort.ascending ? av - bv : bv - av) || a.name.localeCompare(b.name, "pt-BR");
  }), [support.agents, kind, search, sort]);
  const lastPage = Math.max(0, Math.ceil(agents.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleAgents = agents.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const data = useMemo(() => support.activity.map((point) => ({ ...point, Equipe: point.human, IA: point.ai, Recebidas: point.incoming })), [support.activity]);
  const hasActivity = support.activity.some((point) => point.incoming + point.human + point.ai > 0);
  const setSorting = (key: SortKey) => {
    setSort((previous) => ({ key, ascending: previous.key === key ? !previous.ascending : key === "averageFirstReplySeconds" }));
    setPage(0);
  };
  const sortHeader = (key: SortKey, label: string) => <th scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}>
    <button type="button" onClick={() => setSorting(key)} aria-label={`Ordenar por ${label.toLocaleLowerCase("pt-BR")}`} className={styles.sortButton}>{label}<ArrowDown aria-hidden="true" className={`size-3 ${sort.key !== key ? "opacity-25" : ""} ${sort.key === key && sort.ascending ? "rotate-180" : ""}`} /></button>
  </th>;

  return <TooltipProvider delayDuration={150}>
    <section id="dashboard-support" aria-labelledby={titleId} className={`${card.card} ${styles.root}`}>
      <header className={styles.header}>
        <div className="flex items-center gap-2.5">
          <span className={styles.titleIcon}><Headset aria-hidden="true" className="size-4" /></span>
          <div><div className="flex items-center gap-1"><h2 id={titleId} className="text-base font-semibold text-neutral-100">Atendimento</h2><Help label="Como o atendimento é contado">Mensagens registradas no webinar e período selecionados. Cada conversa é contada uma vez no total, mas pode ter respostas de vários atendentes e da IA. Autoria é identificada pela mensagem, independentemente do responsável atual.</Help></div><p className="mt-1 text-sm text-neutral-500">Volume, agilidade e desempenho da equipe</p></div>
        </div>
        {!demo && <Link href="/atendimento" className={styles.conversationsLink}>Ver conversas <ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>}
      </header>

      <dl className={styles.metrics}>
        <div className={styles.metric}><dt><MessageCircle aria-hidden="true" />Conversas</dt><dd>{number.format(support.uniqueConversations)}</dd><dd className={styles.metricNote}>{conversationChange === null ? `${number.format(support.repliedConversations)} com resposta da equipe ou IA` : `${conversationChange >= 0 ? "+" : ""}${Math.round(conversationChange)}% vs. anterior`}</dd></div>
        <div className={styles.metric}><dt><Send aria-hidden="true" />Respostas enviadas</dt><dd>{number.format(totalReplies)}</dd><dd className={styles.metricNote}>{support.uniqueConversations ? `${percent.format(totalReplies / support.uniqueConversations)} por conversa` : `${number.format(support.incomingMessages)} mensagens recebidas`}</dd></div>
        <div className={styles.metric}><dt><Clock aria-hidden="true" />1ª resposta média<Help label="Como a primeira resposta é calculada">Tempo entre a primeira mensagem do público observada e a primeira resposta posterior, ambas dentro do período. A amostra é atribuída somente a quem deu essa primeira resposta. Inclui equipe e IA; não representa tempo de resolução.</Help></dt><dd>{replyTime(support.averageFirstReplySeconds)}</dd><dd className={styles.metricNote}>{support.firstReplySamples ? `${number.format(support.firstReplySamples)} primeiras respostas observadas` : "Sem amostras neste período"}</dd></div>
        <div className={`${styles.metric} ${support.awaitingReplyConversations > 0 ? styles.attention : ""}`}><dt><MessageCircle aria-hidden="true" />Sem retorno<Help label="Como as conversas sem retorno são contadas">Conversas cuja última mensagem dentro do período é do público. É uma leitura histórica do recorte selecionado, não a fila atual: respostas posteriores e encerramentos não são considerados.</Help></dt><dd>{number.format(support.awaitingReplyConversations)}</dd><dd className={styles.metricNote}>sem resposta no recorte</dd></div>
      </dl>

      {queue && <SupportQueue queue={queue} demo={demo} />}

      <div className={styles.body}>
        <div className={styles.activity}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={styles.sectionTitle}>Fluxo de mensagens</h3><div role="group" aria-label="Mensagens no gráfico" className={card.segmented}>{([{ key: "replies", label: "Respostas" }, { key: "incoming", label: "Recebidas" }] as const).map((item) => <motion.button key={item.key} type="button" className={card.segment} aria-pressed={chartMode === item.key} onClick={() => setChartMode(item.key)} whileTap={{ scale: reducedMotion ? 1 : 0.97 }}>{item.label}</motion.button>)}</div></div>
          <p className="mt-1 text-[10px] text-muted-foreground">{chartMode === "replies" ? "Respostas da equipe e da IA por dia" : "Mensagens enviadas pelo público por dia"}</p>
          {hasActivity ? <AreaChart data={data} index="label" categories={chartMode === "replies" ? ["Equipe", "IA"] : ["Recebidas"]} colors={chartMode === "replies" ? ["palco", "chartLime"] : ["palco"]} curveType="linear" className="mt-3 h-36" showLegend={false} allowDecimals={false} minValue={0} yAxisWidth={32} tickGap={24} valueFormatter={(value) => number.format(value)} customTooltip={ActivityTooltip} aria-label={`Fluxo diário de ${chartMode === "replies" ? "respostas da equipe e da IA" : "mensagens recebidas"}. Use as setas para explorar.`} /> : <div className={styles.emptyChart}><MessageCircle aria-hidden="true" className="size-5" /><p>Sem mensagens neste período</p></div>}
          <div className={styles.channels} aria-label="Distribuição das respostas">
            {([{ key: "human", name: "Equipe humana", Icon: Headset, share: humanShare }, { key: "ai", name: "Agentes de IA", Icon: Sparkles, share: aiShare }] as const).map(({ key, name, Icon, share }) => <div key={key} role="group" aria-label={name} className={styles.channel}>
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><i className={key === "human" ? styles.humanDot : styles.aiDot} /><Icon aria-hidden="true" className="size-3" />{name}</span><strong>{totalReplies ? `${percent.format(share)}%` : "—"}</strong></div>
              <p>{number.format(support[key].replies)} respostas <span>· {number.format(support[key].conversations)} conversas</span></p>
            </div>)}
            <div className={styles.channelBar} aria-hidden="true"><span className={styles.humanBar} style={{ width: `${humanShare}%` }} /><span className={styles.aiBar} style={{ width: `${aiShare}%` }} /></div>
          </div>
        </div>

        <div className={styles.performance}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={styles.sectionTitle}>Desempenho por atendente</h3><div role="group" aria-label="Tipo de atendente" className={card.segmented}>{([{ key: "all", label: "Todos" }, { key: "human", label: "Equipe" }, { key: "ai", label: "IA" }] as const).map((item) => <motion.button key={item.key} type="button" className={card.segment} aria-pressed={kind === item.key} onClick={() => { setKind(item.key); setPage(0); }} whileTap={{ scale: reducedMotion ? 1 : 0.97 }}>{item.label}</motion.button>)}</div></div>
          <div className={styles.tableToolbar}><p>{number.format(agents.length)} {agents.length === 1 ? "atendente com respostas" : "atendentes com respostas"}</p><label className={styles.search}><Search aria-hidden="true" className="size-3.5 shrink-0" /><input aria-label="Buscar atendente" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Buscar atendente" /></label></div>
          <div className={styles.tableViewport} role="region" aria-label="Métricas por atendente" tabIndex={0}>
            <table className={styles.table}>
              <caption className="sr-only">Respostas atribuídas ao autor da mensagem no período selecionado. Participação sobre todas as respostas.</caption>
              <thead><tr><th scope="col">Atendente</th>{sortHeader("conversations", "Conversas")}{sortHeader("replies", "Respostas")}{sortHeader("averageFirstReplySeconds", "1ª resposta")}<th scope="col"><span className="inline-flex items-center gap-0.5">Participação<Help label="Como a participação é calculada">Respostas deste atendente divididas por todas as respostas da equipe e IA no período. O filtro da tabela não altera essa base. Representa volume de mensagens, não uma nota de qualidade.</Help></span></th></tr></thead>
              <tbody>{visibleAgents.map((agent) => <AgentRow key={agent.id} agent={agent} totalReplies={totalReplies} />)}</tbody>
            </table>
            {!agents.length && <p className={styles.emptyTable}>{support.agents.length ? "Nenhum atendente encontrado com esses filtros." : "Os atendentes aparecerão aqui assim que enviarem respostas."}</p>}
          </div>
          <div className={styles.tableFooter}><p>Uma conversa pode envolver mais de um atendente.</p>{agents.length > PAGE_SIZE && <nav aria-label="Páginas de atendentes" className="flex shrink-0 items-center gap-2"><span>{currentPage + 1} de {lastPage + 1}</span><button type="button" aria-label="Página anterior de atendentes" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronRight aria-hidden="true" className="rotate-180" /></button><button type="button" aria-label="Próxima página de atendentes" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button></nav>}</div>
        </div>
      </div>
      <div className="sr-only"><table><caption>Mensagens por dia, no horário de Brasília</caption><thead><tr><th scope="col">Data</th><th scope="col">Recebidas</th><th scope="col">Equipe</th><th scope="col">IA</th></tr></thead><tbody>{support.activity.map((point) => <tr key={point.date}><th scope="row">{point.date}</th><td>{point.incoming}</td><td>{point.human}</td><td>{point.ai}</td></tr>)}</tbody></table></div>
    </section>
  </TooltipProvider>;
}

function AgentRow({ agent, totalReplies }: { agent: Agent; totalReplies: number }) {
  const share = totalReplies ? agent.replies / totalReplies * 100 : 0;
  const initials = agent.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR");
  return <tr>
    <th scope="row"><div className={styles.person}><span aria-hidden="true" className={`${styles.avatar} ${agent.kind === "ai" ? styles.aiAvatar : ""}`}>{agent.kind === "ai" ? <Sparkles className="size-3.5" /> : initials}</span><span className="min-w-0"><span className={styles.personName}>{agent.name}</span><span className={styles.personKind}>{agent.kind === "ai" ? "Agente de IA" : agent.kind === "unattributed" ? "Autoria não registrada" : "Equipe humana"}</span></span></div></th>
    <td>{number.format(agent.conversations)}</td><td className="font-semibold">{number.format(agent.replies)}</td><td><Tooltip><TooltipTrigger asChild><button type="button" className={styles.sample} aria-label={`${agent.name}: primeira resposta ${replyTime(agent.averageFirstReplySeconds)}, ${agent.firstReplySamples} amostras`}>{replyTime(agent.averageFirstReplySeconds)}</button></TooltipTrigger><TooltipContent>{agent.firstReplySamples ? `${number.format(agent.firstReplySamples)} primeiras respostas atribuídas a este atendente no período.` : "Este atendente não deu a primeira resposta em nenhuma amostra do período."}</TooltipContent></Tooltip></td><td><div className={styles.share}><span>{totalReplies ? `${percent.format(share)}%` : "—"}</span><div aria-hidden="true"><i className={agent.kind === "ai" ? styles.aiBar : styles.humanBar} style={{ width: `${share}%` }} /></div></div></td>
  </tr>;
}

function waitingFor(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${Math.floor(minutes / 1440)} d`;
}

function SupportQueue({ queue, demo }: { queue: DashboardSupportQueue; demo: boolean }) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className="mt-[22px]">
    <div className="flex items-center justify-between pb-2.5">
      <h3 id={titleId} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[1.4px] text-[#7c867e]">Aguardando resposta<Help label="Quais conversas aguardam resposta">Conversas abertas agora cuja última mensagem é do público, entre as que tiveram mensagens no período. Mesmo critério da caixa de Atendimento.</Help></h3>
      <span className={`text-[11px] font-bold tabular-nums ${queue.waitingTotal ? "text-[#f5b742]" : "text-[#7c867e]"}`}>{number.format(queue.waitingTotal)}</span>
    </div>
    {queue.waiting.length ? <ul className="border-t border-[#1a1f1b]">{queue.waiting.map((item) => {
      const content = <>
        <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[#1a1f1b] text-xs font-bold text-[#c9d1ca]">{item.leadName.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?"}</span>
        <span className="w-[120px] shrink-0 truncate text-[13px] font-semibold text-neutral-100">{item.leadName.trim() || "Sem nome"}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-400">{item.text}</span>
        <time dateTime={item.createdAt} suppressHydrationWarning className="shrink-0 text-xs tabular-nums text-[#6e776f]">{waitingFor(item.createdAt)}</time>
      </>;
      const row = "flex items-center gap-3 py-3";
      return <li key={item.leadId} className="border-b border-[#1a1f1b] last:border-b-0">{demo ? <div className={row}>{content}</div> : <Link href={`/atendimento?leadId=${encodeURIComponent(item.leadId)}`} className={`${row} rounded-md transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-palco motion-reduce:transition-none`}>{content}</Link>}</li>;
    })}</ul> : <p className="border-t border-[#1a1f1b] py-4 text-[13px] text-[#7c867e]">Nenhuma conversa aguardando resposta agora.</p>}
  </section>;
}
