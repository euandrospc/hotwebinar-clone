"use client";

import { useState } from "react";
import { AB_TEST_VARIABLE_LABELS, type AbExperimentDto, type AbVariantConfiguration } from "@/lib/ab-tests";
import styles from "./ab-configuration-comparison.module.css";

type ConfigurationRow = {
  label: string;
  value: (configuration: AbVariantConfiguration) => string;
  note?: string;
  link?: boolean;
};
type ConfigurationGroup = { title: string; rows: ConfigurationRow[] };
const text = (value: string | null | undefined) => value?.trim() ? value : "Não informado";
const enabled = (value: boolean) => value ? "Ativado" : "Desativado";
const duration = (value: number | null) => value === null || !Number.isFinite(value) || value < 0 ? "Não informado"
  : `${Math.floor(value / 60).toString().padStart(2, "0")}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function scheduledDate(value: string | null, timezone: string) {
  if (!value) return "Não definido";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data indisponível";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(date);
  } catch {
    return `${value} · fuso indisponível`;
  }
}

function recurrence(configuration: AbVariantConfiguration) {
  if (!configuration.recurring) return "Desativada";
  const days = [...new Set(configuration.recurringDays)].filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  return days.length ? `Semanal · ${days.map(day => weekdays[day]).join(", ")}` : "Ativa · dias não informados";
}

const groups: ConfigurationGroup[] = [
  { title: "Horário e programação", rows: [
    { label: "Modo", value: c => c.mode === "JIT" ? "Início imediato (JIT)" : "Programado (Único)" },
    { label: "Fuso horário", value: c => text(c.timezone) },
    { label: "Início programado", value: c => scheduledDate(c.startAt, c.timezone) },
    { label: "Fim programado", value: c => scheduledDate(c.endAt, c.timezone) },
    { label: "Recorrência", value: recurrence },
    { label: "Sincronizar vídeo com o início", value: c => enabled(c.videoSyncWithStart) }
  ] },
  { title: "Vídeo e pitch", rows: [
    { label: "Vídeo", value: c => text(c.videoName) },
    { label: "Duração do vídeo", value: c => duration(c.videoDurationSec) },
    { label: "Momento do pitch", value: c => duration(c.pitchAtSec) }
  ] },
  { title: "Oferta", rows: [
    { label: "Exibição da oferta", value: c => c.offerDisabled ? "Desativada" : "Ativada" },
    { label: "Título da oferta", value: c => text(c.offerTitle) },
    { label: "Exibir a partir de", value: c => duration(c.offerShowAtSec) },
    { label: "Ocultar a partir de", value: c => c.offerHideAtSec === null ? "Sem término configurado" : duration(c.offerHideAtSec) },
    { label: "Preço original", value: c => text(c.offerPriceOriginal) },
    { label: "Preço final", value: c => text(c.offerPriceFinal) },
    { label: "Texto do botão", value: c => text(c.offerButtonText) },
    { label: "Link da oferta", value: c => text(c.offerLink), link: true },
    { label: "Repassar UTMs", value: c => enabled(c.offerPassUtms) }
  ] },
  { title: "Formulário e acesso", rows: [
    { label: "Campos habilitados", value: c => ([c.fields.name && "Nome", c.fields.email && "E-mail", c.fields.phone && "Telefone"].filter(Boolean).join(", ") || "Nenhum campo habilitado") },
    { label: "Acesso facilitado", value: c => enabled(c.accessFacilitated) }
  ] },
  { title: "Atendimento e player", rows: [
    { label: "IA no atendimento", value: c => enabled(c.chatAiEnabled) },
    { label: "Nome da IA", value: c => text(c.chatAiName) },
    { label: "Modo do contador de audiência", value: c => ({ NONE: "Oculto", FIXED: "Fixo", DYNAMIC: "Dinâmico" }[c.audienceMode] ?? text(c.audienceMode)), note: "Exibição no player; não representa audiência real." }
  ] }
];

function safeLink(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function AbConfigurationComparison({ experiment }: { experiment: AbExperimentDto }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const configuration = experiment.configuration;
  if (!configuration) return <div className={styles.empty} role="status">Configuração das variantes indisponível para este teste.</div>;

  const compared = groups.map(group => ({ ...group, rows: group.rows.map(row => {
    const A = row.value(configuration.A), B = row.value(configuration.B);
    return { ...row, A, B, different: A !== B };
  }) }));
  const differenceCount = compared.reduce((count, group) => count + group.rows.filter(row => row.different).length, 0);
  const visibleGroups = compared.map(group => ({ ...group, rows: group.rows.filter(row => !differencesOnly || row.different) })).filter(group => group.rows.length > 0);
  const recorded = configuration.frozen;
  const sourceTitle = recorded ? "Configuração registrada ao iniciar"
    : experiment.status === "DRAFT" ? "Configuração atual · rascunho"
    : experiment.mode === "OBSERVATIONAL" ? "Configuração atual dos webinars" : "Configuração atual · sem registro inicial";
  const sourceDetail = recorded ? "Valores preservados do início do teste. Alterações posteriores nos webinars não aparecem nesta tabela."
    : experiment.status === "DRAFT" ? "Os valores serão registrados quando o experimento for iniciado."
    : experiment.mode === "OBSERVATIONAL" ? "Estes valores não reconstituem a configuração do período histórico."
    : "Este teste não possui uma configuração inicial registrada. Os valores abaixo refletem os webinars atuais.";

  return <section className={styles.root} aria-label="Configuração das variantes">
    <div className={styles.source}><strong>{sourceTitle}</strong><p>{sourceDetail}</p></div>
    <div className={styles.toolbar}>
      <p>{experiment.testVariable ? AB_TEST_VARIABLE_LABELS[experiment.testVariable] : "Configuração A/B"}<span>{differenceCount} {differenceCount === 1 ? "diferença" : "diferenças"}</span></p>
      <label className={styles.filter}><input type="checkbox" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)} />Só diferenças</label>
    </div>
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabela de configuração A e B">
      <table aria-label="Comparativo de configuração A e B">
        <thead><tr><th scope="col">Configuração</th>{(["A", "B"] as const).map(key => <th key={key} scope="col">
          <div className={styles.variant}><b className={key === "A" ? styles.variantA : styles.variantB}>{key}</b><span>{text(configuration[key].title)}</span></div>
          {(key === "A" ? experiment.variantADescription : experiment.variantBDescription) && <small className={styles.description}>{key === "A" ? experiment.variantADescription : experiment.variantBDescription}</small>}
        </th>)}</tr></thead>
        {visibleGroups.map(group => <tbody key={group.title}>
          <tr className={styles.group}><th colSpan={3} scope="rowgroup">{group.title}</th></tr>
          {group.rows.map(row => <tr key={row.label} className={row.different ? styles.different : undefined}>
            <th scope="row"><span>{row.label}{row.different && <span className={styles.marker} aria-label="Valores diferentes" title="Valores diferentes" />}</span>{row.note && <small>{row.note}</small>}</th>
            {(["A", "B"] as const).map(key => { const href = row.link ? safeLink(row[key]) : null; return <td key={key}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{row[key]}</a> : row[key]}</td>; })}
          </tr>)}
        </tbody>)}
      </table>
      {visibleGroups.length === 0 && <p className={styles.empty} role="status">Nenhuma diferença nos campos comparados.</p>}
    </div>
    <p className={styles.note}>Horários no fuso de cada variante. Posições e durações em minutos:segundos. Os destaques indicam diferenças de configuração, sem avaliar desempenho.</p>
  </section>;
}
