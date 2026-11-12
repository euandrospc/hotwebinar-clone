"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, RefreshCw, Target } from "@/components/icons";
import { AB_METRIC_LABELS, AB_TEST_VARIABLE_LABELS, type AbExperimentDto, type AbMetric, type AbMode, type AbWebinarOption, type AbTestVariable } from "@/lib/ab-tests";
import { calculateSampleSize } from "@/lib/ab-statistics";
import { cn } from "@/lib/utils";
import { calendarFilters, count, dayInBrasilia, percent } from "./ab-utils";
import adminStyles from "@/components/admin/admin-page.module.css";
import styles from "./ab-tests.module.css";

export interface AbExperimentInput {
  name: string; hypothesis: string; mode: AbMode; metric: AbMetric;
  webinarAId: string; webinarBId: string; baselineRate: number; minimumDetectableLift: number;
  durationDays: number; conversionWindowHours: number; from?: string; to?: string;
  testVariable?: AbTestVariable; variantADescription?: string; variantBDescription?: string;
}

export function AbExperimentForm({ experiment, webinars, onClose, onSave }: {
  experiment?: AbExperimentDto; webinars: AbWebinarOption[];
  onClose: () => void; onSave: (value: AbExperimentInput) => Promise<void>;
}) {
  const [name, setName] = useState(experiment?.name ?? "");
  const [hypothesis, setHypothesis] = useState(experiment?.hypothesis ?? "");
  const [testVariable, setTestVariable] = useState<AbTestVariable>(experiment?.testVariable ?? "FULL_WEBINAR");
  const [variantADescription, setVariantADescription] = useState(experiment?.variantADescription ?? "");
  const [variantBDescription, setVariantBDescription] = useState(experiment?.variantBDescription ?? "");
  const [mode, setMode] = useState<AbMode>(experiment?.mode ?? "RANDOMIZED");
  const [metric, setMetric] = useState<AbMetric>(experiment?.metric ?? "PURCHASE");
  const [webinarAId, setWebinarAId] = useState(experiment?.webinarAId ?? webinars[0]?.id ?? "");
  const [webinarBId, setWebinarBId] = useState(experiment?.webinarBId ?? webinars[1]?.id ?? "");
  const [baseline, setBaseline] = useState(String((experiment?.baselineRate ?? .05) * 100));
  const [lift, setLift] = useState(String((experiment?.minimumDetectableLift ?? .2) * 100));
  const [duration, setDuration] = useState(String(experiment?.durationDays ?? 14));
  const [windowHours, setWindowHours] = useState(String(experiment?.conversionWindowHours ?? 72));
  const [expectedDailyTraffic, setExpectedDailyTraffic] = useState("");
  const [from, setFrom] = useState(dayInBrasilia(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(dayInBrasilia());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let sampleSize: number | null = null;
  try { sampleSize = calculateSampleSize(Number(baseline) / 100, Number(lift) / 100); } catch { /* Invalid planning inputs are explained on submit. */ }
  const baselineRate = Number(baseline) / 100;
  const minimumDetectableLift = Number(lift) / 100;
  const collectionDays = Number(duration);
  const plannedWindowDays = Number(windowHours) / 24;
  const dailyTarget = sampleSize && collectionDays >= 7 && collectionDays <= 90 ? Math.ceil(sampleSize * 2 / collectionDays) : null;
  const expectedTraffic = Number(expectedDailyTraffic);
  const estimatedCollectionDays = sampleSize && expectedTraffic > 0 && Number.isFinite(expectedTraffic) ? Math.ceil(sampleSize * 2 / expectedTraffic) : null;
  const insufficientTraffic = estimatedCollectionDays !== null && dailyTarget !== null && estimatedCollectionDays > collectionDays;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    if (!name.trim() || !hypothesis.trim()) { setError("Preencha o nome e a hipótese do teste."); return; }
    if (!webinarAId || !webinarBId || webinarAId === webinarBId) { setError("Escolha dois webinars diferentes para A e B."); return; }
    if (mode === "RANDOMIZED" && (!sampleSize || !Number.isFinite(sampleSize))) { setError("Informe uma conversão base e um ganho mínimo válidos. A conversão esperada deve ficar abaixo de 100%."); return; }
    if (mode === "OBSERVATIONAL" && (!from || !to || from > to)) { setError("Informe um período válido para comparar os acessos."); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), hypothesis: hypothesis.trim(), testVariable, variantADescription: variantADescription.trim(), variantBDescription: variantBDescription.trim(), mode, metric, webinarAId, webinarBId, baselineRate: mode === "RANDOMIZED" ? baselineRate : .05, minimumDetectableLift: mode === "RANDOMIZED" ? minimumDetectableLift : .2, durationDays: mode === "RANDOMIZED" ? Number(duration) : 14, conversionWindowHours: Number(windowHours), ...(mode === "OBSERVATIONAL" ? calendarFilters(from, to) : {}) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o teste."); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className={cn(adminStyles.portal, styles.formDialog)} onInteractOutside={event => { if (saving) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{experiment ? "Editar planejamento" : "Novo teste A/B"}</DialogTitle><DialogDescription>Uma hipótese, dois webinars e uma métrica principal para orientar a decisão.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className={styles.form}>
        <fieldset disabled={saving} className={styles.formFields}>
          <div className={styles.modePicker} role="radiogroup" aria-label="Modalidade do teste">
            {(["RANDOMIZED", "OBSERVATIONAL"] as const).map(value => <button key={value} type="button" role="radio" aria-checked={mode === value} tabIndex={mode === value ? 0 : -1} disabled={Boolean(experiment)} className={cn(styles.modeOption, mode === value && styles.modeActive)} onClick={() => setMode(value)} onKeyDown={event => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault();
                const next = value === "RANDOMIZED" ? "OBSERVATIONAL" : "RANDOMIZED";
                setMode(next);
                (event.currentTarget.parentElement?.children[next === "RANDOMIZED" ? 0 : 1] as HTMLButtonElement | undefined)?.focus();
              }
            }}>
              <span>{value === "RANDOMIZED" ? "Experimento com divisão de tráfego" : "Comparar webinars existentes"}</span>
              <small>{value === "RANDOMIZED" ? "Um link distribui visitantes em 50% A / 50% B." : "Analise o histórico e encontre hipóteses para testar."}</small>
            </button>)}
          </div>
          <label className={styles.field}><span>Nome do teste</span><input autoFocus value={name} onChange={event => setName(event.target.value)} required minLength={3} maxLength={120} placeholder="Ex.: abertura direta × abertura com história" /></label>
          <label className={styles.field}><span>O que você quer testar?</span><select aria-label="O que você quer testar?" value={testVariable} onChange={event => setTestVariable(event.target.value as AbTestVariable)}>{Object.entries(AB_TEST_VARIABLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.field}><span>Hipótese</span><textarea aria-label="Hipótese" aria-describedby="ab-hypothesis-help" value={hypothesis} onChange={event => setHypothesis(event.target.value)} required rows={2} maxLength={2000} placeholder="Ao mudar…, esperamos aumentar… porque…" /><small id="ab-hypothesis-help">Descreva o que muda de A para B e por quê. Ao comparar webinars inteiros, o resultado avalia o conjunto das mudanças.</small></label>
          <div className={styles.fieldGrid}><label className={styles.field}><span>Condição A · controle</span><textarea aria-label="Condição A · controle" rows={2} maxLength={1000} value={variantADescription} onChange={event => setVariantADescription(event.target.value)} placeholder={testVariable === "SCHEDULE" ? "Ex.: webinar às 19h, mesmo vídeo e oferta" : "Ex.: abertura atual, pitch aos 30 min"} /></label><label className={styles.field}><span>Condição B · mudança</span><textarea aria-label="Condição B · mudança" rows={2} maxLength={1000} value={variantBDescription} onChange={event => setVariantBDescription(event.target.value)} placeholder={testVariable === "SCHEDULE" ? "Ex.: webinar às 21h, mesmo vídeo e oferta" : "Ex.: abertura direta, mantendo pitch e oferta"} /></label></div>
          {testVariable === "SCHEDULE" && <p className={styles.formNote}><Info aria-hidden="true" />Configure os horários nos dois webinars antes de iniciar. Este teste permite programações diferentes e mede também o efeito da espera. A janela de conversão começa na entrada de cada visitante; escolha uma janela que comporte a transmissão e a oportunidade de compra.</p>}
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span><b className={styles.variantA}>A</b> Webinar de controle</span><select value={webinarAId} onChange={event => setWebinarAId(event.target.value)} required><option value="" disabled>Selecione um webinar</option>{webinars.map(webinar => <option key={webinar.id} value={webinar.id} disabled={webinar.id === webinarBId}>{webinar.title || webinar.name}{webinar.status !== "ACTIVE" ? " (não publicado)" : ""}</option>)}</select></label>
            <label className={styles.field}><span><b className={styles.variantB}>B</b> Webinar variante</span><select value={webinarBId} onChange={event => setWebinarBId(event.target.value)} required><option value="" disabled>Selecione um webinar</option>{webinars.map(webinar => <option key={webinar.id} value={webinar.id} disabled={webinar.id === webinarAId}>{webinar.title || webinar.name}{webinar.status !== "ACTIVE" ? " (não publicado)" : ""}</option>)}</select></label>
          </div>
          <p className={styles.formNote}>Escolha duas versões já configuradas em Webinars. As condições acima documentam a mudança; horários, vídeo e oferta são definidos no editor de cada versão.</p>
          <div className={styles.variantSwap}><Button type="button" variant="ghost" className={styles.button} disabled={!webinarAId || !webinarBId} onClick={() => { setWebinarAId(webinarBId); setWebinarBId(webinarAId); setVariantADescription(variantBDescription); setVariantBDescription(variantADescription); }}><RefreshCw aria-hidden="true" />Inverter A e B</Button></div>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Métrica principal</span><select value={metric} onChange={event => setMetric(event.target.value as AbMetric)}>{Object.entries(AB_METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Cada visitante converte no máximo uma vez.</small></label>
            <label className={styles.field}><span>Janela de conversão</span><select value={windowHours} onChange={event => setWindowHours(event.target.value)}><option value="24">24 horas após a entrada</option><option value="72">72 horas após a entrada</option><option value="168">7 dias após a entrada</option></select><small>A mesma oportunidade de conversão para A e B.</small></label>
          </div>
          {mode === "RANDOMIZED" ? <>
            <div className={styles.formSection}><Target aria-hidden="true" /><div><strong>Planejamento da amostra</strong><small>Defina antes de começar. O plano fica bloqueado após o início.</small></div><span className={styles.badge}>95% de confiança · 80% de poder</span></div>
            <div className={styles.fieldGridThree}>
              <label className={styles.field}><span>Conversão base (%)</span><input type="number" min="0.01" max="95" step="0.01" value={baseline} onChange={event => setBaseline(event.target.value)} required /><small>Taxa esperada no controle.</small></label>
              <label className={styles.field}><span>Efeito mínimo detectável (%)</span><input aria-label="Efeito mínimo detectável (%)" type="number" min="1" max="500" step="0.1" value={lift} onChange={event => setLift(event.target.value)} required /><small>Variação relativa usada para dimensionar a amostra.</small></label>
              <label className={styles.field}><span>Duração da coleta (dias)</span><input type="number" min="7" max="90" step="1" value={duration} onChange={event => setDuration(event.target.value)} required /><small>Mínimo de um ciclo semanal.</small></label>
            </div>
            <div className={styles.samplePreview} aria-live="polite"><div><span>Amostra planejada por variante</span><strong>{sampleSize ? count(sampleSize) : "—"}<small> visitantes</small></strong></div><p>{sampleSize ? <>Detectar uma mudança de <b>{percent(baselineRate)}</b> para <b>{percent(baselineRate * (1 + minimumDetectableLift))}</b>. Total aproximado: {count(sampleSize * 2)} visitantes.</> : "Ajuste a taxa base e o ganho mínimo para calcular a amostra."}</p></div>
            <div className={styles.feasibility} aria-label="Viabilidade do teste">
              <div className={styles.feasibilityFacts} aria-live="polite"><div><span>Tráfego necessário · A + B</span><strong>{dailyTarget ? count(dailyTarget) : "—"}<small> entradas por dia</small></strong></div><div><span>Primeira leitura final planejada</span><strong>{dailyTarget ? count(collectionDays + plannedWindowDays) : "—"}<small> dias após iniciar</small></strong></div></div>
              <details><summary>Simular com meu tráfego</summary><label className={styles.field}><span>Entradas esperadas por dia · A + B</span><input aria-label="Entradas esperadas por dia · A + B" type="number" min="1" step="1" value={expectedDailyTraffic} onChange={event => setExpectedDailyTraffic(event.target.value)} placeholder="Ex.: 500" /><small>Estimativa usada apenas nesta simulação. Conte visitantes que entrarão pelo link do teste.</small></label>
                {estimatedCollectionDays !== null && dailyTarget !== null && <p className={cn(styles.feasibilityResult, insufficientTraffic && styles.feasibilityCaution)} role="status">{insufficientTraffic ? <>Com esse tráfego, a amostra exigiria aproximadamente <b>{count(estimatedCollectionDays)} dias de coleta</b>, além da janela de {count(plannedWindowDays)} dias. O prazo de {count(collectionDays)} dias é curto para essa amostra. Revise o plano antes de iniciar.</> : <>Esse volume permite planejar a amostra no prazo. Mesmo que ela chegue antes, mantenha os {count(collectionDays)} dias de coleta e aguarde a janela de {count(plannedWindowDays)} dias.</>}</p>}
              </details>
              <p className={styles.smallNote}>Estimativa com divisão 50/50; o sorteio pode gerar diferenças de volume. O efeito mínimo detectável define a sensibilidade do teste, não uma garantia de retorno comercial.</p>
            </div>
            <p className={styles.formNote}><Info aria-hidden="true" />O teste é salvo como rascunho. Ao iniciar, use o link do teste nas campanhas; os webinars precisam estar publicados. A leitura final também aguarda a janela de conversão.</p>
          </> : <>
            <div className={styles.fieldGrid}><label className={styles.field}><span>Entradas a partir de</span><input type="date" required value={from} max={to} onChange={event => setFrom(event.target.value)} /></label><label className={styles.field}><span>Entradas até</span><input type="date" required value={to} min={from} max={dayInBrasilia()} onChange={event => setTo(event.target.value)} /></label></div>
            <p className={styles.formNote}><Info aria-hidden="true" />O histórico compara acessos identificados, no fuso de Brasília. Como os públicos não foram sorteados, diferenças observadas não comprovam que uma versão causou mais conversões.</p>
          </>}
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.dialogActions}><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving || webinars.length < 2}>{saving ? "Salvando…" : experiment ? "Salvar planejamento" : mode === "RANDOMIZED" ? "Criar rascunho" : "Criar comparação"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
