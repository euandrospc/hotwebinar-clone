"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AdminEmptyState, AdminPage, AdminPageHeader, AdminSurface } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, Filter, Info, Pencil, Play, Plus, RefreshCw, Target, Trash2 } from "@/components/icons";
import { AB_METRIC_LABELS, AB_STATUS_LABELS, AB_TEST_VARIABLE_LABELS, type AbExperimentDto, type AbReport, type AbReportFilters, type AbWebinarOption } from "@/lib/ab-tests";
import { cn } from "@/lib/utils";
import { AbExperimentForm, type AbExperimentInput } from "./ab-experiment-form";
import { AbReportPanel } from "./ab-report-panel";
import { AbTestPicker } from "./ab-test-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calendarFilters, dateLabel, downloadAbCsv } from "./ab-utils";
import adminStyles from "@/components/admin/admin-page.module.css";
import styles from "./ab-tests.module.css";
import { createAbTestsDemo, getAbTestsDemoReport } from "@/lib/ab-tests-demo";
import { calculateSampleSize } from "@/lib/ab-statistics";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "Não foi possível concluir esta ação.");
  return body as T;
}
const pastCollection = (experiment: AbExperimentDto) => experiment.mode === "RANDOMIZED" && experiment.endsAt !== null && new Date(experiment.endsAt).getTime() <= Date.now();
const statusLabel = (experiment: AbExperimentDto) => pastCollection(experiment) && ["RUNNING", "PAUSED"].includes(experiment.status) ? "Coleta encerrada" : AB_STATUS_LABELS[experiment.status];

type TransitionAction = "start" | "pause" | "resume" | "complete" | "delete";
const actionLabels: Record<TransitionAction, string> = { start: "Iniciar teste", pause: "Pausar coleta", resume: "Retomar coleta", complete: "Encerrar coleta", delete: "Excluir rascunho" };
const filterLabels = { source: "Origem · UTM source", medium: "Mídia · UTM medium", campaign: "Campanha · UTM campaign", content: "Criativo · UTM content", device: "Dispositivo" };
const deviceLabels: Record<string, string> = { desktop: "Desktop", mobile: "Celular", tablet: "Tablet", unknown: "Não informado", __unknown__: "Não informado" };

function ExperimentContext({ experiment, busy, onEdit, onAction, demo, picker }: {
  experiment: AbExperimentDto; busy: boolean; onEdit: () => void;
  onAction: (action: TransitionAction) => void; demo: boolean; picker: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const closed = pastCollection(experiment);

  useEffect(() => { setCopied(false); setCopyError(null); }, [experiment.id]);

  async function copyLink() {
    if (!experiment.publicPath) return;
    setCopyError(null);
    try { await navigator.clipboard.writeText(new URL(experiment.publicPath, window.location.origin).href); setCopied(true); }
    catch { setCopyError("Não foi possível copiar. Selecione o link abaixo e copie manualmente."); }
  }

  return <AdminSurface className={styles.context}>
    <h2 className="sr-only">{experiment.name}</h2>
    <div className={styles.contextHeader}>
      <div className={styles.testSelection}>{picker}</div>
      <div className={styles.actions}>
        <span className={styles.badge} data-status={experiment.status}>{statusLabel(experiment)}</span>
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" className={styles.button}><Info aria-hidden="true" />Detalhes</Button></PopoverTrigger>
          <PopoverContent align="end" collisionPadding={14} className={cn(adminStyles.portal, styles.contextPopover)} aria-label="Detalhes do teste">
            <h3>Hipótese do teste</h3>
            <p className={styles.hypothesis}>{experiment.hypothesis}</p>
            <dl className={styles.contextFacts}>
              <div><dt>Variável testada</dt><dd>{AB_TEST_VARIABLE_LABELS[experiment.testVariable ?? "FULL_WEBINAR"]}</dd></div>
              <div><dt>Modalidade</dt><dd>{experiment.mode === "RANDOMIZED" ? "Experimento randomizado · 50 / 50" : "Comparação observacional"}</dd></div>
              <div><dt>Métrica principal</dt><dd>{AB_METRIC_LABELS[experiment.metric]}</dd></div>
              <div><dt>Janela de conversão</dt><dd>{experiment.conversionWindowHours} horas</dd></div>
              <div><dt>Criado em</dt><dd>{dateLabel(experiment.createdAt)}</dd></div>
            </dl>
            {experiment.publicPath && <div className={styles.publicLink}><span>Link de distribuição</span><code>{typeof window !== "undefined" ? new URL(experiment.publicPath, window.location.origin).href : experiment.publicPath}</code><Button variant="outline" className={styles.button} onClick={copyLink}><Copy aria-hidden="true" />{copied ? "Link copiado" : "Copiar link"}</Button></div>}
            {experiment.status === "PAUSED" && !closed && <p className={styles.smallNote}>Novos visitantes não entram durante a pausa. O prazo original continua correndo. Uma pausa antes do fim torna a leitura exploratória, mesmo após retomar.</p>}
            {closed && <p className={styles.smallNote}>A coleta já atingiu o prazo. As conversões continuam sendo observadas até completar a janela de cada visitante.</p>}
            {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
          </PopoverContent>
        </Popover>
        {experiment.status === "DRAFT" && <><Button variant="outline" className={styles.button} onClick={onEdit} disabled={busy}><Pencil aria-hidden="true" />Editar</Button><Button variant="ghost" className={styles.iconButton} aria-label="Excluir rascunho" onClick={() => onAction("delete")} disabled={busy}><Trash2 aria-hidden="true" /></Button><Button className={styles.button} onClick={() => onAction("start")} disabled={busy}><Play aria-hidden="true" />Iniciar teste</Button></>}
        {experiment.status === "RUNNING" && !closed && <Button variant="outline" className={styles.button} onClick={() => onAction("pause")} disabled={busy}>Pausar coleta</Button>}
        {experiment.status === "PAUSED" && !closed && <Button className={styles.button} onClick={() => onAction("resume")} disabled={busy}><Play aria-hidden="true" />Retomar coleta</Button>}
        {["RUNNING", "PAUSED"].includes(experiment.status) && <Button variant="outline" className={styles.button} onClick={() => onAction("complete")} disabled={busy}>{closed ? "Concluir teste" : "Encerrar coleta"}</Button>}
      </div>
    </div>
    <div className={styles.variantLinks}>{(["A", "B"] as const).map(key => {
      const webinar = key === "A" ? experiment.webinarA : experiment.webinarB;
      const content = <><b className={key === "A" ? styles.variantA : styles.variantB}>{key}</b><span>{webinar.title || webinar.name}</span></>;
      return demo ? <span key={key} className={styles.previewVariant}>{content}</span> : <Link key={key} href={`/dashboard/webinars/${webinar.id}/metrics`}>{content}</Link>;
    })}<span className={styles.metricContext}>{AB_METRIC_LABELS[experiment.metric]} · janela de {experiment.conversionWindowHours}h</span></div>
  </AdminSurface>;
}

function ExperimentDetail({ experiment, demo = false }: { experiment: AbExperimentDto; demo?: boolean }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AbReportFilters>({});
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; report: AbReport } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [filterOptions, setFilterOptions] = useState<AbReport["filterOptions"] | null>(null);
  const requestSequence = useRef(0);
  const serializedFilters = JSON.stringify(filters);
  const reportKey = `${experiment.id}:${serializedFilters}`;
  const report = result?.key === reportKey ? result.report : null;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setLoading(true); setError(null);
    const params = new URLSearchParams(JSON.parse(serializedFilters) as Record<string, string>);
    const pendingReport = demo
      ? Promise.resolve().then(() => getAbTestsDemoReport(experiment, JSON.parse(serializedFilters)))
      : request<AbReport>(`/api/ab-tests/${experiment.id}/report${params.size ? `?${params}` : ""}`, { signal: controller.signal });
    pendingReport
      .then(value => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setResult({ key: `${experiment.id}:${serializedFilters}`, report: value });
        setFilterOptions(value.filterOptions);
      })
      .catch(cause => { if (!controller.signal.aborted && sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o relatório."); })
      .finally(() => { if (!controller.signal.aborted && sequence === requestSequence.current) setLoading(false); });
    return () => controller.abort();
  }, [experiment.id, experiment.updatedAt, serializedFilters, revision, demo]);

  useEffect(() => {
    if (experiment.status !== "RUNNING") return;
    const timer = window.setInterval(() => setRevision(value => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, [experiment.status]);

  function applyFilters() {
    if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) { setFilterError("A data inicial deve ser anterior ou igual à final."); return; }
    setFilterError(null);
    const next: AbReportFilters = calendarFilters(draftFilters.from ?? "", draftFilters.to ?? "");
    for (const key of Object.keys(filterLabels) as (keyof typeof filterLabels)[]) if (draftFilters[key]) next[key] = draftFilters[key];
    setFilters(next);
  }

  return <div className={styles.detail}>
    <div className={styles.reportToolbar}><div className={styles.actions}><Button variant="outline" className={styles.button} aria-expanded={filtersOpen} aria-controls="ab-report-filters" onClick={() => setFiltersOpen(value => !value)}><Filter aria-hidden="true" />Filtros{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}</Button><span className={styles.filterSummary}>{activeFilterCount ? "Recorte exploratório" : "Todo o período e público do teste"}</span>{activeFilterCount > 0 && <button className={styles.textButton} type="button" onClick={() => { setFilters({}); setDraftFilters({}); setFilterError(null); }}>Limpar filtros</button>}</div><div className={styles.actions}><span className={styles.updated} role="status">{loading ? "Atualizando resultados…" : report ? `Atualizado às ${new Date(report.generatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}</span><Button variant="outline" className={styles.iconButton} disabled={loading} aria-label="Atualizar resultados" onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" /></Button><Button variant="outline" className={styles.button} disabled={!report || loading || Boolean(error)} onClick={() => report && downloadAbCsv(report)}><Download aria-hidden="true" />Exportar CSV</Button></div></div>
    {filtersOpen && <AdminSurface><form id="ab-report-filters" className={styles.filters} onSubmit={event => { event.preventDefault(); applyFilters(); }}>
      <div className={styles.filterFields}><label className={styles.field}><span>Entradas a partir de</span><input type="date" value={draftFilters.from ?? ""} max={draftFilters.to || undefined} onChange={event => setDraftFilters(value => ({ ...value, from: event.target.value }))} /></label><label className={styles.field}><span>Entradas até</span><input type="date" value={draftFilters.to ?? ""} min={draftFilters.from || undefined} onChange={event => setDraftFilters(value => ({ ...value, to: event.target.value }))} /></label>
        {(Object.keys(filterLabels) as (keyof typeof filterLabels)[]).map(key => <label key={key} className={styles.field}><span>{filterLabels[key]}</span><select value={draftFilters[key] ?? ""} onChange={event => setDraftFilters(value => ({ ...value, [key]: event.target.value }))}><option value="">Todos</option>{Array.from(new Set([...(filterOptions?.[key] ?? []), ...(draftFilters[key] ? [draftFilters[key]] : [])])).map(value => <option key={value} value={value}>{value === "__unknown__" ? "Não informado" : key === "device" ? deviceLabels[value] ?? value : value}</option>)}</select></label>)}
      </div><div className={styles.filterFooter}><p><Info aria-hidden="true" />Datas de entrada em Brasília. Filtros mantêm a janela de conversão e tornam a leitura exploratória.</p><Button type="submit" className={styles.button}>Aplicar filtros</Button></div>{filterError && <p role="alert" className={styles.error}>{filterError}</p>}
    </form></AdminSurface>}
    {error ? <AdminSurface><div className={styles.loadError} role="alert"><strong>Não foi possível atualizar os resultados</strong><p>{error}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div></AdminSurface> : report ? <div aria-busy={loading}><AbReportPanel report={report} /></div> : <AdminSurface><div className={styles.loading} role="status">Carregando o comparativo…</div></AdminSurface>}
  </div>;
}

export function AbTestsManager({ demo = false }: { demo?: boolean }) {
  // Defense in depth: an accidentally enabled prop still cannot show fixtures in production.
  const demoEnabled = demo && process.env.NODE_ENV === "development";
  const [preview] = useState(() => demoEnabled ? createAbTestsDemo() : null);
  const reduceMotion = useReducedMotion();
  const [experiments, setExperiments] = useState<AbExperimentDto[]>([]);
  const [webinars, setWebinars] = useState<AbWebinarOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | AbExperimentDto | null>(null);
  const [confirmation, setConfirmation] = useState<{ experiment: AbExperimentDto; action: TransitionAction } | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listRevision, setListRevision] = useState(0);
  const selected = experiments.find(experiment => experiment.id === selectedId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    const pendingList = preview
      ? Promise.resolve(preview)
      : request<{ experiments: AbExperimentDto[]; webinars: AbWebinarOption[] }>("/api/ab-tests", { signal: controller.signal });
    pendingList.then(data => {
      if (controller.signal.aborted) return;
      setExperiments(data.experiments); setWebinars(data.webinars);
      const linked = new URL(window.location.href).searchParams.get("test");
      setSelectedId(current => data.experiments.some(item => item.id === current) ? current : data.experiments.find(item => item.id === linked)?.id ?? data.experiments[0]?.id ?? null);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os testes."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [listRevision, preview]);

  const selectExperiment = useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href); url.searchParams.set("test", id); window.history.replaceState(null, "", url);
  }, []);

  async function saveExperiment(input: AbExperimentInput) {
    const editing = form && form !== "new" ? form : null;
    const { mode: _mode, from: _from, to: _to, ...editable } = input;
    const body = editing ? { action: "edit", ...editable } : input;
    let result: { experiment: AbExperimentDto };
    if (preview) {
      const now = new Date().toISOString();
      const webinarA = preview.webinars.find(webinar => webinar.id === input.webinarAId);
      const webinarB = preview.webinars.find(webinar => webinar.id === input.webinarBId);
      if (!webinarA || !webinarB || webinarA.id === webinarB.id) throw new Error("Escolha dois webinars diferentes.");
      if (editing && editing.status !== "DRAFT") throw new Error("O plano fica fixo após o início.");
      const historical = input.mode === "OBSERVATIONAL";
      const configurationFor = (id: string) => preview.experiments.flatMap(item => [
        { id: item.webinarAId, value: item.configuration?.A }, { id: item.webinarBId, value: item.configuration?.B }
      ]).find(item => item.id === id && item.value)?.value;
      const configA = configurationFor(webinarA.id), configB = configurationFor(webinarB.id);
      result = { experiment: {
        ...editable, mode: input.mode, id: editing?.id ?? `demo-ab-local-${crypto.randomUUID()}`,
        webinarA, webinarB, sampleSizePerVariant: calculateSampleSize(input.baselineRate, input.minimumDetectableLift),
        status: historical ? "COMPLETED" : "DRAFT", createdAt: editing?.createdAt ?? now, updatedAt: now,
        startedAt: historical ? input.from ?? null : null, endsAt: historical ? input.to ?? null : null,
        completedAt: historical ? now : null, interruptedAt: null, assignmentCount: 0, publicPath: null,
        ...(configA && configB ? { configuration: { A: configA, B: configB, frozen: false } } : {})
      } };
      preview.experiments = [result.experiment, ...preview.experiments.filter(item => item.id !== result.experiment.id)];
    } else {
      result = await request<{ experiment: AbExperimentDto }>(editing ? `/api/ab-tests/${editing.id}` : "/api/ab-tests", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
    }
    setExperiments(current => [result.experiment, ...current.filter(item => item.id !== result.experiment.id)]);
    selectExperiment(result.experiment.id); setForm(null);
  }

  async function applyAction() {
    if (!confirmation || busy) return;
    setBusy(true); setMutationError(null);
    try {
      const { action, experiment } = confirmation;
      if (action === "delete") {
        if (preview) preview.experiments = preview.experiments.filter(item => item.id !== experiment.id);
        else await request(`/api/ab-tests/${experiment.id}`, { method: "DELETE" });
        setExperiments(current => current.filter(item => item.id !== experiment.id));
        setSelectedId(experiments.find(item => item.id !== experiment.id)?.id ?? null);
      } else {
        let result: { experiment: AbExperimentDto };
        if (preview) {
          const now = new Date();
          const changed: AbExperimentDto = { ...experiment, updatedAt: now.toISOString() };
          if (action === "start") {
            changed.status = "RUNNING"; changed.startedAt = now.toISOString();
            changed.endsAt = new Date(now.getTime() + changed.durationDays * 86_400_000).toISOString();
            if (changed.configuration) changed.configuration = { ...changed.configuration, frozen: true };
          } else if (action === "pause") {
            changed.status = "PAUSED";
            changed.interruptedAt = changed.interruptedAt ?? now.toISOString();
          } else if (action === "resume") changed.status = "RUNNING";
          else { changed.status = "COMPLETED"; changed.completedAt = now.toISOString(); }
          result = { experiment: changed };
          preview.experiments = preview.experiments.map(item => item.id === changed.id ? changed : item);
        } else {
          result = await request<{ experiment: AbExperimentDto }>(`/api/ab-tests/${experiment.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
        }
        setExperiments(current => current.map(item => item.id === result.experiment.id ? result.experiment : item));
      }
      setConfirmation(null);
    } catch (cause) { setMutationError(cause instanceof Error ? cause.message : "Não foi possível alterar o teste."); }
    finally { setBusy(false); }
  }

  return <AdminPage className={styles.page}>
    <AdminPageHeader title="Teste A/B" actions={<Button className={styles.button} disabled={loading || webinars.length < 2} onClick={() => setForm("new")}><Plus aria-hidden="true" />Novo teste</Button>} />
    {loading ? <AdminSurface><div className={styles.loading} role="status">Carregando seus testes…</div></AdminSurface> : error ? <AdminSurface><div className={styles.loadError} role="alert"><strong>Não foi possível carregar os testes</strong><p>{error}</p><Button variant="outline" onClick={() => setListRevision(value => value + 1)}>Tentar novamente</Button></div></AdminSurface> : experiments.length === 0 ? <AdminSurface><AdminEmptyState icon={<Target />} title="Uma hipótese. Duas versões. Uma decisão melhor." description={webinars.length < 2 ? "Crie pelo menos dois webinars para comparar versões, explorar o histórico ou dividir o tráfego em um experimento." : "Comece comparando seus webinars atuais ou crie um experimento com distribuição de tráfego, amostra planejada e acompanhamento da conversão."} action={webinars.length < 2 ? <Button asChild><Link href="/dashboard/webinars">Ir para Webinars</Link></Button> : <Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Criar primeiro teste</Button>} /><div className={styles.emptyGuide}><div><b>01</b><strong>Defina a mudança</strong><p>Escolha o controle, a variante e o resultado que quer melhorar.</p></div><div><b>02</b><strong>Compare com contexto</strong><p>Examine audiência, origem, criativo e etapas do webinar.</p></div><div><b>03</b><strong>Decida com evidências</strong><p>Acompanhe amostra, janela de conversão e qualidade dos dados.</p></div></div></AdminSurface> : <>
      {selected && <section className={styles.detail} aria-label={`Teste selecionado: ${selected.name}`}>
        <ExperimentContext experiment={selected} demo={Boolean(preview)} busy={busy} onEdit={() => setForm(selected)} onAction={action => { setMutationError(null); setConfirmation({ experiment: selected, action }); }} picker={<AbTestPicker experiments={experiments} selectedId={selected.id} onSelect={selectExperiment} />} />
        <motion.div key={selected.id} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .2 }}><ExperimentDetail experiment={selected} demo={Boolean(preview)} /></motion.div>
      </section>}
    </>}
    {form && <AbExperimentForm experiment={form === "new" ? undefined : form} webinars={webinars} onClose={() => setForm(null)} onSave={saveExperiment} />}
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}><DialogContent className={cn(adminStyles.portal, styles.confirmDialog)}><DialogHeader><DialogTitle>{confirmation ? actionLabels[confirmation.action] : "Confirmar ação"}</DialogTitle><DialogDescription>{confirmation?.experiment.name}</DialogDescription></DialogHeader><p className={styles.confirmText}>{confirmation?.action === "start" ? "O planejamento ficará bloqueado. O link distribuirá novos visitantes em 50% A e 50% B. Use o mesmo link nas campanhas e mantenha a mudança testada estável até concluir o experimento." : confirmation?.action === "complete" ? "A coleta de novos visitantes será encerrada. Quem já entrou poderá voltar à sua variante, e as conversões continuarão sendo observadas dentro da janela. Encerrar antes do prazo torna a leitura antecipada e impede uma conclusão definitiva." : confirmation?.action === "pause" ? "Novos visitantes ficarão fora enquanto a coleta estiver pausada. Participantes existentes mantêm sua variante e o prazo não é estendido. Pausar antes do fim torna a conclusão exploratória, mesmo após retomar. Para uma conclusão confirmatória, crie um novo teste." : confirmation?.action === "resume" ? "O link voltará a distribuir novos visitantes entre as versões. O plano e o prazo original serão mantidos. A interrupção anterior mantém a leitura exploratória; um novo teste é necessário para uma conclusão confirmatória." : "Este rascunho será excluído. Os webinars e seus dados continuarão disponíveis."}</p>{mutationError && <p role="alert" className={styles.error}>{mutationError}</p>}<div className={styles.dialogActions}><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button><Button disabled={busy} variant={confirmation?.action === "delete" ? "destructive" : "default"} onClick={applyAction}>{busy ? "Aguarde…" : confirmation ? actionLabels[confirmation.action] : "Confirmar"}</Button></div></DialogContent></Dialog>
  </AdminPage>;
}
