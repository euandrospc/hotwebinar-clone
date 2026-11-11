"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Info, LoaderCircle, MessageCircle, MessageSquare, RefreshCw, Sparkles } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatIntelligenceBatchResult, ChatIntelligenceReport } from "@/lib/dashboard-chat-intelligence";
import card from "./dashboard-card.module.css";
import styles from "./dashboard-chat-intelligence.module.css";

interface Props {
  webinarId?: string;
  from: string;
  to: string;
  demoReport?: ChatIntelligenceReport;
}

type InsightKind = "objections" | "questions";
type RequestScope = { controller: AbortController };
const PAGE_SIZE = 5;
const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const timestamp = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timestamp.format(date) : "Data indisponível";
}

class ChatIntelligenceRequestError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "";
    if (response.status === 401) throw new Error("Sua sessão expirou. Atualize a página para continuar.");
    if (response.status === 409 && code === "provider_missing") throw new ChatIntelligenceRequestError("A integração de IA não está configurada no servidor. Configure a chave de IA e recarregue os resultados para continuar.", code);
    if (response.status === 429) throw new Error("O serviço de IA atingiu o limite de uso. Aguarde alguns instantes e tente novamente. O progresso já salvo foi preservado.");
    if (response.status === 403 && code === "invalid_origin") throw new Error("Não foi possível validar este acesso. Abra novamente a plataforma pelo endereço oficial e tente analisar as mensagens.");
    if (response.status === 409 && code === "analysis_changed") throw new Error("A configuração da análise mudou durante o processamento. Recarregue os resultados antes de continuar.");
    if (response.status === 403 || response.status === 404) throw new Error("Não foi possível acessar as mensagens deste webinar.");
    if (response.status === 400) throw new Error("Não foi possível analisar o período selecionado.");
    throw new Error("Não foi possível concluir a análise. O progresso já salvo será preservado. Tente novamente.");
  }
  return response.json() as Promise<T>;
}

/** A new scope remounts the view, clearing details, pagination and obsolete requests together. */
export function DashboardChatIntelligence(props: Props) {
  return <ChatIntelligenceView key={JSON.stringify([props.webinarId, props.from, props.to, Boolean(props.demoReport)])} {...props} />;
}

function ChatIntelligenceView({ webinarId, from, to, demoReport }: Props) {
  const titleId = useId();
  const providerNoticeId = useId();
  const [report, setReport] = useState<ChatIntelligenceReport | null>(demoReport ?? null);
  const [loading, setLoading] = useState(!demoReport && Boolean(webinarId));
  const [running, setRunning] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedOperation, setFailedOperation] = useState<"load" | "analyze" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ kind: InsightKind; id: string } | null>(null);
  const scopeRef = useRef<RequestScope | null>(null);
  const runningRef = useRef(false);
  const pauseRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const currentReport = demoReport ?? report;
  const query = new URLSearchParams({ webinarId: webinarId ?? "", from, to });
  const endpoint = `/api/dashboard/chat-intelligence?${query.toString()}`;
  const isActive = (scope: RequestScope) => scopeRef.current === scope && !scope.controller.signal.aborted;

  async function requestReport(scope: RequestScope) {
    return readResponse<ChatIntelligenceReport>(await fetch(endpoint, {
      credentials: "same-origin", cache: "no-store", signal: scope.controller.signal
    }));
  }

  async function loadReport(scope: RequestScope, manual = false) {
    setLoading(true);
    setError(null);
    setFailedOperation(null);
    setNotice(null);
    try {
      const result = await requestReport(scope);
      if (isActive(scope)) {
        setReport(result);
        if (manual) setNotice("Resultados recarregados.");
      }
    } catch (cause) {
      if (isActive(scope)) {
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar a análise.");
        setFailedOperation("load");
      }
    } finally {
      if (isActive(scope)) setLoading(false);
    }
  }

  useEffect(() => {
    const scope = { controller: new AbortController() };
    scopeRef.current = scope;
    if (!demoReport && webinarId) void loadReport(scope);
    return () => {
      scope.controller.abort();
      wakeRef.current?.();
      if (scopeRef.current === scope) scopeRef.current = null;
    };
    // Scope props are captured by the keyed parent. Demo data never reaches the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function waitForAvailableSlot(scope: RequestScope, milliseconds: number) {
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        scope.controller.signal.removeEventListener("abort", finish);
        if (wakeRef.current === finish) wakeRef.current = null;
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      wakeRef.current = finish;
      scope.controller.signal.addEventListener("abort", finish, { once: true });
      if (scope.controller.signal.aborted || pauseRef.current) finish();
    });
  }

  async function analyze() {
    const scope = scopeRef.current;
    if (!scope || demoReport || !webinarId || !currentReport?.providerReady || runningRef.current) return;
    runningRef.current = true;
    pauseRef.current = false;
    setRunning(true);
    setPauseRequested(false);
    setError(null);
    setFailedOperation(null);
    setNotice(null);
    let latest = currentReport;
    let busyChecks = 0;
    try {
      // Each successful request persists a bounded batch. No corpus-size cap is imposed here.
      while (isActive(scope) && !pauseRef.current && latest.pendingMessages > 0) {
        if (latest.isProcessing) {
          if (busyChecks >= 6) {
            setNotice("Outra análise continua em andamento. Atualize o painel em instantes para acompanhar.");
            break;
          }
          setNotice("Outra análise está em andamento. Aguardando para continuar…");
          await waitForAvailableSlot(scope, Math.min(1500 * 2 ** busyChecks, 8000));
          if (!isActive(scope) || pauseRef.current) break;
          latest = await requestReport(scope);
          if (!isActive(scope)) break;
          setReport(latest);
          busyChecks++;
          continue;
        }
        const result = await readResponse<ChatIntelligenceBatchResult>(await fetch("/api/dashboard/chat-intelligence", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webinarId, from, to }), signal: scope.controller.signal
        }));
        if (!isActive(scope)) break;
        latest = result.report;
        setReport(latest);
        setNotice(null);
        if (result.busy) {
          // Some responses arrive immediately after another process claims the lease.
          latest = { ...latest, isProcessing: true };
          continue;
        }
        busyChecks = 0;
        if (!result.processedMessages && latest.pendingMessages > 0) {
          throw new Error("A análise não avançou. O progresso foi salvo; tente continuar em instantes.");
        }
      }
      if (isActive(scope) && pauseRef.current && latest.pendingMessages > 0) {
        setNotice("Análise pausada. O progresso foi salvo e pode ser retomado.");
      }
    } catch (cause) {
      if (isActive(scope)) {
        setError(cause instanceof Error ? cause.message : "Não foi possível concluir a análise.");
        const providerMissing = cause instanceof ChatIntelligenceRequestError && cause.code === "provider_missing";
        if (providerMissing) setReport((current) => current ? { ...current, providerReady: false } : current);
        setFailedOperation(providerMissing ? "load" : "analyze");
      }
    } finally {
      runningRef.current = false;
      if (isActive(scope)) {
        setRunning(false);
        setPauseRequested(false);
      }
    }
  }

  function retry() {
    if (failedOperation === "analyze") void analyze();
    else if (scopeRef.current) void loadReport(scopeRef.current, true);
  }

  function pause() {
    pauseRef.current = true;
    setPauseRequested(true);
    wakeRef.current?.();
  }

  const selected = selection ? currentReport?.[selection.kind].find((category) => category.id === selection.id) : undefined;
  const progress = currentReport?.totalMessages ? Math.min(100, currentReport.analyzedMessages / currentReport.totalMessages * 100) : 0;
  const partial = Boolean(currentReport?.pendingMessages);
  const providerMissing = currentReport && !currentReport.providerReady && !demoReport;
  const pending = currentReport?.pendingMessages ?? 0;
  const initialLoading = loading && !currentReport;

  return <TooltipProvider delayDuration={150}>
    <section id="dashboard-chat-intelligence" aria-labelledby={titleId} className={styles.root}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarHeading}>
          <span className={styles.toolbarIcon}><Sparkles aria-hidden="true" className="size-4" /></span>
          <div>
            <h2 id={titleId}>Objeções e dúvidas do público</h2>
            <p>Entenda as barreiras de compra e os pontos que precisam de mais clareza.</p>
          </div>
        </div>
        {!demoReport && webinarId && <div className={styles.actions}>
          {currentReport && <button type="button" className={styles.refresh} aria-label="Recarregar resultados" aria-busy={loading} disabled={loading || running} onClick={() => { if (scopeRef.current) void loadReport(scopeRef.current, true); }}><RefreshCw aria-hidden="true" className={loading ? styles.spinner : "size-3.5"} /><span>{loading ? "Recarregando…" : "Recarregar resultados"}</span></button>}
          {running ? <button type="button" className={styles.pause} onClick={pause} disabled={pauseRequested} aria-label="Pausar análise">{pauseRequested ? "Pausando…" : "Pausar análise"}</button> : <button type="button" className={styles.analyze} onClick={() => void analyze()} disabled={loading || !currentReport?.providerReady || !pending} aria-describedby={providerMissing ? providerNoticeId : undefined}>
            <Sparkles aria-hidden="true" className="size-3.5" />{currentReport?.analyzedMessages ? "Atualizar análise" : "Analisar mensagens"}
          </button>}
        </div>}
      </header>

      <div className={`${styles.coverage} ${providerMissing ? styles.coverageBlocked : ""}`} role="status" aria-live="polite">
        {initialLoading ? <span className={styles.statusLine}><LoaderCircle aria-hidden="true" className={styles.spinner} />Carregando a análise das mensagens…</span> : !webinarId && !demoReport ? <span>Selecione um webinar para analisar as mensagens.</span> : currentReport ? <>
          <div className={styles.statusLine}>
            {running && <LoaderCircle aria-hidden="true" className={styles.spinner} />}
            <span><strong>{number.format(currentReport.analyzedMessages)}</strong> de {number.format(currentReport.totalMessages)} mensagens analisadas</span>
            {providerMissing ? <span className={styles.partial}>IA não configurada</span> : partial && <span className={styles.partial}>{running ? "Analisando" : currentReport.analyzedMessages ? "Análise parcial" : "Aguardando análise"}</span>}
            {!partial && currentReport.totalMessages > 0 && <span className={styles.complete}>Análise completa</span>}
          </div>
          <div className={styles.coverageMeta}>
            <span>Somente mensagens do público · período selecionado</span>
            {currentReport.lastAnalyzedAt && <time dateTime={currentReport.lastAnalyzedAt}>Atualizada em {displayDate(currentReport.lastAnalyzedAt)}</time>}
          </div>
          {providerMissing && <p id={providerNoticeId} className={styles.providerNotice}>Configure a chave de IA no servidor e recarregue os resultados para liberar a análise. Os resultados já salvos continuam disponíveis.</p>}
          {partial && <div className={styles.progress} role="progressbar" aria-label="Mensagens analisadas" aria-valuenow={currentReport.analyzedMessages} aria-valuemax={currentReport.totalMessages} aria-valuemin={0}><span style={{ width: `${progress}%` }} /></div>}
        </> : <span>A análise ainda não está disponível.</span>}
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={loading || running} onClick={retry}>Tentar novamente</button></div>}

      <div className={styles.grid}>
        <InsightTable kind="objections" report={currentReport} loading={initialLoading} onSelect={(id) => setSelection({ kind: "objections", id })} />
        <InsightTable kind="questions" report={currentReport} loading={initialLoading} onSelect={(id) => setSelection({ kind: "questions", id })} />
      </div>
      <p className={styles.disclaimer}>Uma mensagem pode conter mais de uma categoria e aparecer nas duas tabelas. A classificação por IA pode ser revisada nas mensagens originais.</p>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelection(null); }}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <span className={styles.dialogEyebrow}>{selection?.kind === "objections" ? "Objeção identificada" : "Dúvida frequente"}</span>
            <DialogTitle className={styles.dialogTitle}>{selected?.label}</DialogTitle>
            <DialogDescription className={styles.dialogDescription}>{selected ? `${number.format(selected.messageCount)} mensagens em ${number.format(selected.conversationCount)} conversas no período. Exemplos do que o público escreveu.` : "Mensagens originais do público."}</DialogDescription>
          </DialogHeader>
          {selected && <div className={styles.dialogBody}>
            <div className={styles.guidance}><h3>Sugestão de abordagem</h3><p>{selected.guidance}</p></div>
            <div className={styles.examplesHeader}><h3>Mensagens originais</h3><span>{Math.min(selected.examples.length, 5)} exemplos</span></div>
            {selected.examples.slice(0, 5).map((example) => <article className={styles.example} key={example.id}>
              <blockquote>{example.text}</blockquote>
              <footer><time dateTime={example.createdAt}>{displayDate(example.createdAt)} · Brasília</time>{!demoReport && <Link href={`/atendimento?leadId=${encodeURIComponent(example.leadId)}`}>Abrir conversa <ArrowUpRight aria-hidden="true" className="size-3" /></Link>}</footer>
            </article>)}
            {!selected.examples.length && <p className={styles.noExamples}>Não há exemplos disponíveis para esta categoria.</p>}
          </div>}
        </DialogContent>
      </Dialog>
    </section>
  </TooltipProvider>;
}

function InsightTable({ kind, report, loading, onSelect }: {
  kind: InsightKind;
  report: ChatIntelligenceReport | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const titleId = useId();
  const [page, setPage] = useState(0);
  const rows = (report?.[kind] ?? []).filter((category) => category.messageCount > 0)
    .slice().sort((a, b) => b.messageCount - a.messageCount || a.label.localeCompare(b.label, "pt-BR"));
  const lastPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const shown = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const isObjection = kind === "objections";
  const noun = isObjection ? "objeções" : "dúvidas";
  const title = isObjection ? "Objeções por categoria" : "Dúvidas frequentes";
  const count = report ? isObjection ? report.objectionMessages : report.questionMessages : null;
  const Icon = isObjection ? MessageSquare : MessageCircle;
  let empty = "Analise as mensagens para identificar os temas mais recorrentes.";
  if (loading) empty = "Carregando os temas…";
  else if (report?.totalMessages === 0) empty = "Nenhuma mensagem do público neste período.";
  else if (report && report.analyzedMessages > 0) empty = `Nenhuma ${isObjection ? "objeção" : "dúvida"} identificada nas ${number.format(report.analyzedMessages)} mensagens já analisadas.`;

  return <section className={`${card.card} ${styles.panel}`} aria-labelledby={titleId}>
    <header className={styles.panelHeader}>
      <div><span className={`${styles.panelIcon} ${isObjection ? styles.objectionIcon : ""}`}><Icon aria-hidden="true" className="size-3.5" /></span><h3 id={titleId}>{title}</h3></div>
      <Tooltip><TooltipTrigger asChild><button type="button" className={styles.help} aria-label={`Como ${noun} são contadas`}><Info aria-hidden="true" className="size-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-72 text-xs leading-relaxed">{isObjection ? "Objeções são barreiras ou resistências expressas pelo público. Perguntar o preço, por si só, não indica uma objeção." : "Perguntas semelhantes são agrupadas pelo assunto. Os títulos resumem o tema; abra a linha para ler as mensagens originais."} A participação usa as mensagens com {isObjection ? "objeção" : "dúvida"} já analisadas, não todas as mensagens do chat.</TooltipContent></Tooltip>
    </header>
    <div className={styles.panelSummary}><strong>{count === null || loading || (report?.analyzedMessages === 0 && report.totalMessages > 0) ? "—" : number.format(count)}</strong><span>mensagens com {isObjection ? "objeção" : "dúvida"}</span><span className={styles.categoryCount}>{rows.length} {isObjection ? "categorias" : "assuntos"}</span></div>
    <div className={styles.tableViewport} role="region" aria-label={`Tabela de ${noun}`} tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">{title}, ordenadas por quantidade de mensagens</caption>
        <thead><tr><th scope="col">{isObjection ? "Categoria" : "Dúvida / assunto"}</th><th scope="col">Mensagens</th><th scope="col">Conversas</th><th scope="col">Participação</th></tr></thead>
        <tbody>{shown.map((row, index) => <tr key={row.id}>
          <th scope="row"><button type="button" className={styles.rowButton} onClick={() => onSelect(row.id)} aria-label={`Ver mensagens: ${row.label}`}><span className={styles.rank}>{String(currentPage * PAGE_SIZE + index + 1).padStart(2, "0")}</span><span>{row.label}</span><ChevronRight aria-hidden="true" className={styles.rowArrow} /></button></th>
          <td className={styles.messageCount}>{number.format(row.messageCount)}</td><td>{number.format(row.conversationCount)}</td><td><div className={styles.percentage}><span>{percent.format(row.percentage)}%</span><i aria-hidden="true"><span style={{ width: `${Math.min(100, row.percentage)}%` }} /></i></div></td>
        </tr>)}</tbody>
      </table>
      {!shown.length && <div className={styles.empty}><Icon aria-hidden="true" className="size-5" /><p>{empty}</p></div>}
    </div>
    <footer className={styles.panelFooter}><span>{rows.length ? "Selecione um tema para ver as mensagens." : "As respostas da equipe e da IA não entram nesta análise."}</span>{rows.length > PAGE_SIZE && <nav className={styles.pagination} aria-label={`Páginas de ${noun}`}><span>{currentPage + 1} de {lastPage + 1}</span><button type="button" aria-label={`Página anterior de ${noun}`} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronRight aria-hidden="true" className="size-3.5 rotate-180" /></button><button type="button" aria-label={`Próxima página de ${noun}`} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" className="size-3.5" /></button></nav>}</footer>
  </section>;
}
