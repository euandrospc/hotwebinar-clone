"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronLeftIcon as ChevronLeft, ChevronRight, Search, Target, X } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AB_METRIC_LABELS, AB_STATUS_LABELS, type AbExperimentDto } from "@/lib/ab-tests";
import { cn } from "@/lib/utils";
import adminStyles from "@/components/admin/admin-page.module.css";
import styles from "./ab-test-picker.module.css";

const PAGE_SIZE = 6;
const statusLabels = { ...AB_STATUS_LABELS, COLLECTION_ENDED: "Coleta encerrada" };
type PickerStatus = keyof typeof statusLabels;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function displayStatus(experiment: AbExperimentDto): PickerStatus {
  if (experiment.mode === "RANDOMIZED" && (experiment.status === "RUNNING" || experiment.status === "PAUSED") && experiment.endsAt && new Date(experiment.endsAt).getTime() <= Date.now()) return "COLLECTION_ENDED";
  return experiment.status;
}

export interface AbTestPickerProps {
  experiments: AbExperimentDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Keeps the comparison in view; experiment browsing lives in this compact popover. */
export function AbTestPicker({ experiments, selectedId, onSelect }: AbTestPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const selected = experiments.find(experiment => experiment.id === selectedId);
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return experiments.filter(experiment => (!status || displayStatus(experiment) === status)
      && (!mode || experiment.mode === mode)
      && [experiment.name, experiment.hypothesis, experiment.webinarA.name, experiment.webinarA.title, experiment.webinarB.name, experiment.webinarB.title].some(value => normalize(value).includes(needle)));
  }, [experiments, query, status, mode, open]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const offset = (activePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(offset, offset + PAGE_SIZE);
  const selectedOnPage = visible.some(experiment => experiment.id === selectedId);
  const hasFilters = Boolean(query || status || mode);

  function changeOpen(value: boolean) {
    if (value) {
      const selectedIndex = filtered.findIndex(experiment => experiment.id === selectedId);
      setPage(selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) + 1 : 1);
    }
    setOpen(value);
  }

  function focusOption(index: number) {
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus();
  }

  function navigateOptions(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowDown" ? (index + 1) % visible.length
      : event.key === "ArrowUp" ? (index + visible.length - 1) % visible.length
      : event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 : null;
    if (target !== null) { event.preventDefault(); focusOption(target); }
  }

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <button type="button" className={styles.trigger} disabled={!experiments.length} aria-label={`Selecionar teste: ${selected?.name ?? "nenhum selecionado"}`}>
        <Target className={styles.triggerIcon} aria-hidden="true" />
        <span className={styles.triggerName} title={selected?.name}>{selected?.name ?? "Selecionar teste"}</span>
        <span className={styles.total}>{experiments.length.toLocaleString("pt-BR")} {experiments.length === 1 ? "teste" : "testes"}</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} collisionPadding={12} className={cn(adminStyles.portal, styles.popover)} aria-labelledby={headingId} onOpenAutoFocus={event => { event.preventDefault(); searchRef.current?.focus(); }}>
      <div className={styles.header}><h2 id={headingId}>Selecionar teste</h2><button type="button" className={styles.iconButton} aria-label="Fechar seletor de testes" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
      <div className={styles.controls}>
        <label className={styles.search}><Search aria-hidden="true" /><input ref={searchRef} aria-label="Buscar teste" placeholder="Buscar nome, hipótese ou webinar…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} onKeyDown={event => { if (event.key === "ArrowDown" && visible.length) { event.preventDefault(); focusOption(0); } }} />{query && <button type="button" aria-label="Limpar busca de testes" onClick={() => { setQuery(""); setPage(1); searchRef.current?.focus(); }}><X aria-hidden="true" /></button>}</label>
        <div className={styles.filters}>
          <select aria-label="Filtrar testes por status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Filtrar testes por modalidade" value={mode} onChange={event => { setMode(event.target.value); setPage(1); }}><option value="">Todas as modalidades</option><option value="RANDOMIZED">Experimento randomizado</option><option value="OBSERVATIONAL">Comparação observacional</option></select>
        </div>
      </div>
      <div ref={listRef} className={styles.list} role="listbox" aria-label="Testes disponíveis">
        {visible.map((experiment, index) => {
          const current = experiment.id === selectedId;
          const shownStatus = displayStatus(experiment);
          return <button type="button" key={experiment.id} role="option" aria-selected={current} tabIndex={current || (!selectedOnPage && index === 0) ? 0 : -1} className={cn(styles.option, current && styles.selected)} onClick={() => { onSelect(experiment.id); setOpen(false); }} onKeyDown={event => navigateOptions(event, index)}>
            <div className={styles.optionHeading}><strong title={experiment.name}>{experiment.name}</strong>{current && <Check aria-hidden="true" />}</div>
            <p title={`A: ${experiment.webinarA.title || experiment.webinarA.name} · B: ${experiment.webinarB.title || experiment.webinarB.name}`}><span>A</span> {experiment.webinarA.title || experiment.webinarA.name}<i aria-hidden="true"> / </i><span>B</span> {experiment.webinarB.title || experiment.webinarB.name}</p>
            <div className={styles.metadata}><span className={styles.status} data-status={shownStatus}>{statusLabels[shownStatus]}</span><span>{experiment.mode === "RANDOMIZED" ? "Experimento · 50/50" : "Histórico"}</span><span>{AB_METRIC_LABELS[experiment.metric]}</span></div>
          </button>;
        })}
      </div>
      {visible.length === 0 && <div className={styles.empty} role="status">Nenhum teste encontrado com esses filtros.</div>}
      <div className={styles.footer}>
        <div className={styles.resultCount} aria-live="polite">{filtered.length ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, filtered.length)} de ${filtered.length}` : "0 testes"}{hasFilters && <button type="button" onClick={() => { setQuery(""); setStatus(""); setMode(""); setPage(1); }}>Limpar filtros</button>}</div>
        {pageCount > 1 && <nav className={styles.pagination} aria-label="Páginas de testes"><button type="button" className={styles.iconButton} disabled={activePage === 1} aria-label="Página anterior de testes" onClick={() => setPage(activePage - 1)}><ChevronLeft aria-hidden="true" /></button><span>{activePage} / {pageCount}</span><button type="button" className={styles.iconButton} disabled={activePage === pageCount} aria-label="Próxima página de testes" onClick={() => setPage(activePage + 1)}><ChevronRight aria-hidden="true" /></button></nav>}
      </div>
    </PopoverContent>
  </Popover>;
}
