import type { AbExperimentDto, AbInferenceState, AbReport, AbReportFilters, AbVariantKey, AbVariantReport } from "@/lib/ab-tests";
import { AB_METRIC_LABELS, abMetricBase } from "@/lib/ab-tests";
import { compareProportions, sampleRatioMismatchPValue, wilsonInterval } from "@/lib/ab-statistics";
import { buildAbDiagnostics, type AbDiagnosticUnit } from "@/lib/ab-insights";

export const AB_UNKNOWN_FILTER = "__unknown__";
export interface AbReportUnit {
  id: string; variant: AbVariantKey; webinarId: string; leadId: string | null; email: string | null;
  assignedAt: Date; source: string | null; medium: string | null; campaign: string | null;
  content: string | null; device: string | null;
}
/** Aggregated inside the unit's own conversion window, never over its lifetime. */
export interface AbReportEvent {
  unitId: string; kind: "OPTIN" | "VIDEO_TICK" | "PITCH_REACHED" | "OFFER_CLICK";
  firstOccurredAt: Date; maxVideoSec: number | null;
  /** First heartbeat actually at/after pitch; max position alone cannot date the crossing. */
  firstPitchAt?: Date | null;
}
export interface AbReportSale {
  id: string; webinarId: string | null; leadId: string | null;
  amount: number; currency: string; createdAt: Date;
}
export interface BuildAbReportInput {
  experiment: AbExperimentDto; units: readonly AbReportUnit[]; events: readonly AbReportEvent[];
  sales: readonly AbReportSale[]; pitchAtSec: { A: number | null; B: number | null };
  filters?: AbReportFilters; now?: Date; configurationChanged?: boolean;
}

const segmentKeys = ["source", "medium", "campaign", "content", "device"] as const;
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
function dateKey(date: Date) {
  const parts = dayFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function realEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && !normalized.endsWith("@no-email.invalid") ? normalized : null;
}
function segment(value: string | null) { return value?.trim() || AB_UNKNOWN_FILTER; }
function emptyVariant(key: AbVariantKey, experiment: AbExperimentDto): AbVariantReport {
  const webinar = key === "A" ? experiment.webinarA : experiment.webinarB;
  return { key, webinarId: webinar.id, label: webinar.title || webinar.name || `Variante ${key}`,
    assigned: 0, mature: 0, pending: 0, ...(experiment.mode === "OBSERVATIONAL" ? { evaluated: 0 } : {}), identified: 0, viewers: 0, pitch: 0, clicks: 0,
    buyers: 0, sales: 0, revenueCents: 0, conversions: 0, rate: null, interval: null };
}

function inferenceDescription(state: AbInferenceState, experiment: AbExperimentDto): { title: string; detail: string } {
  if (state === "WINNER_A" || state === "WINNER_B") {
    const variant = state === "WINNER_A" ? "A" : "B";
    const metric = AB_METRIC_LABELS[experiment.metric].toLocaleLowerCase("pt-BR");
    return {
      title: `${variant} teve maior taxa de ${metric}`,
      detail: `No período planejado, a diferença na taxa de ${metric} favorece ${variant} no teste bilateral de 5%, com amostra e janelas completas. `
        + (experiment.metric === "PURCHASE" ? "Isso não comprova aumento de receita." : "Isso não comprova aumento de compras ou receita.")
    };
  }
  const text: Record<Exclude<AbInferenceState, "WINNER_A" | "WINNER_B">, [string, string]> = {
    DRAFT: ["Pronto para planejar", "Defina a hipótese, a métrica principal e o período antes de iniciar a coleta."],
    OBSERVATIONAL: ["Comparação observacional", "Os públicos não foram sorteados. As diferenças descrevem estes webinars e não demonstram que a versão causou o resultado."],
    EXPLORATORY: ["Recorte exploratório", "Os filtros alteram a população planejada. A decisão do teste usa o período completo e todas as origens e dispositivos."],
    COLLECTING: ["Coleta em andamento", "A decisão exige o período planejado completo e a maturação das janelas. A entrada de novos visitantes encerra automaticamente no prazo; resultados parciais não definem um vencedor."],
    MATURING: ["Aguardando conversões", "A coleta terminou. Aguarde a janela de conversão de todos os visitantes antes de concluir o teste."],
    INSUFFICIENT: ["Amostra insuficiente", "Ainda não há a amostra planejada em cada versão ou dez sucessos e dez não conversores por grupo para a aproximação estatística. Este teste não permite uma decisão confiável."],
    INTEGRITY: ["Verifique a qualidade dos dados", "Há mudanças nas versões, desequilíbrio de distribuição ou identidades repetidas entre alocações. Resolva essa inconsistência antes de interpretar a diferença como efeito da versão."],
    EARLY_STOP: ["Coleta interrompida", "A coleta foi pausada ou encerrada antes do prazo planejado. Mesmo após retomar ou aguardar o prazo, os resultados permanecem descritivos: interromper ao observar uma diferença pode produzir uma conclusão falsa."],
    INCONCLUSIVE: ["Resultado inconclusivo", "A amostra e o período foram cumpridos, mas não houve evidência suficiente de diferença. Isso não demonstra equivalência entre as versões."]
  };
  return { title: text[state][0], detail: text[state][1] };
}

/**
 * Intent-to-treat denominator: every mature randomized browser stays in its arm.
 * When several assignments identify the same lead, outcomes belong only to its
 * first assignment; all denominator units remain and inference is blocked.
 * Emails detect known contamination, never infer sale attribution.
 */
export function buildAbReport(input: BuildAbReportInput): AbReport {
  const { experiment } = input;
  const observed = experiment.mode === "OBSERVATIONAL";
  const now = input.now ?? new Date();
  const filters = input.filters ?? {};
  const windowMs = experiment.conversionWindowHours * 3_600_000;
  const startedAt = experiment.startedAt ? new Date(experiment.startedAt).getTime() : null;
  const endsAt = experiment.endsAt ? new Date(experiment.endsAt).getTime() : null;
  const completedAt = experiment.completedAt ? new Date(experiment.completedAt).getTime() : null;
  const interruptedAt = experiment.interruptedAt ? new Date(experiment.interruptedAt).getTime() : null;
  const from = filters.from ? new Date(filters.from).getTime() : -Infinity;
  const to = filters.to ? new Date(filters.to).getTime() : Infinity;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(windowMs) || windowMs <= 0 || Number.isNaN(from) || Number.isNaN(to) || from > to) {
    throw new RangeError("Invalid experiment report range");
  }
  const collectionEnd = Math.min(endsAt ?? now.getTime(), experiment.mode === "RANDOMIZED" ? completedAt ?? Infinity : Infinity, now.getTime());
  const seenUnitIds = new Set<string>();
  const units = input.units.filter((unit) => {
    const at = unit.assignedAt.getTime();
    if (startedAt === null || !Number.isFinite(at) || at < startedAt || at > collectionEnd || seenUnitIds.has(unit.id)) return false;
    if (unit.webinarId !== (unit.variant === "A" ? experiment.webinarAId : experiment.webinarBId)) return false;
    seenUnitIds.add(unit.id);
    return true;
  }).sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime() || a.id.localeCompare(b.id));
  const filterOptions = Object.fromEntries(segmentKeys.map((key) => [key,
    [...new Set(units.map((unit) => segment(unit[key])))].sort((a, b) => a.localeCompare(b, "pt-BR"))
  ])) as AbReport["filterOptions"];

  const leadAssignments = new Map<string, AbReportUnit[]>();
  const emailAssignments = new Map<string, Set<AbVariantKey>>();
  const armEmailAssignments = new Map<string, AbReportUnit[]>();
  for (const unit of units) {
    if (unit.leadId) {
      const key = `${unit.webinarId}:${unit.leadId}`;
      const assigned = leadAssignments.get(key) ?? [];
      assigned.push(unit);
      leadAssignments.set(key, assigned);
    }
    const email = realEmail(unit.email);
    if (email) {
      const arms = emailAssignments.get(email) ?? new Set<AbVariantKey>();
      arms.add(unit.variant);
      emailAssignments.set(email, arms);
      const key = `${unit.variant}:${email}`;
      const assigned = armEmailAssignments.get(key) ?? [];
      assigned.push(unit);
      armEmailAssignments.set(key, assigned);
    }
  }
  // Count connected duplicate identities once, even when both the lead id and
  // normalized email repeat. Database email uniqueness is case-sensitive.
  const identityParent = new Map(units.map((unit) => [unit.id, unit.id]));
  const identityRoot = (id: string): string => {
    let root = id;
    while (identityParent.get(root) !== root) root = identityParent.get(root)!;
    let cursor = id;
    while (cursor !== root) { const next = identityParent.get(cursor)!; identityParent.set(cursor, root); cursor = next; }
    return root;
  };
  for (const assigned of [...leadAssignments.values(), ...armEmailAssignments.values()]) {
    for (const unit of assigned.slice(1)) identityParent.set(identityRoot(unit.id), identityRoot(assigned[0].id));
  }
  const identitySizes = new Map<string, number>();
  for (const unit of units) { const root = identityRoot(unit.id); identitySizes.set(root, (identitySizes.get(root) ?? 0) + 1); }
  const duplicateIdentities = [...identitySizes.values()].filter((size) => size > 1).length;
  const overlapPeople = [...emailAssignments.values()].filter((arms) => arms.size > 1).length;
  const fullCountA = units.filter((unit) => unit.variant === "A").length;
  const srmPValue = experiment.mode === "RANDOMIZED" ? sampleRatioMismatchPValue(fullCountA, units.length - fullCountA) : null;
  const selected = units.filter((unit) => unit.assignedAt.getTime() >= from && unit.assignedAt.getTime() <= to
    && segmentKeys.every((key) => !filters[key] || segment(unit[key]) === filters[key]));
  const selectedIds = new Set(selected.map((unit) => unit.id));
  const matureIds = new Set(selected.filter((unit) => unit.assignedAt.getTime() + windowMs <= now.getTime()).map((unit) => unit.id));
  const variants: [AbVariantReport, AbVariantReport] = [emptyVariant("A", experiment), emptyVariant("B", experiment)];
  const stateByUnit = new Map(units.map((unit) => [unit.id, { unit, viewer: false, pitch: false, click: false, buyer: false, sales: 0, revenue: 0, maxVideoSec: null as number | null,
    firstPlaybackAt: null as Date | null, firstPitchAt: null as Date | null, firstClickAt: null as Date | null, firstPurchaseAt: null as Date | null }]));
  const earlier = (current: Date | null, next: Date) => !current || next < current ? next : current;
  const ownsOutcomes = (unit: AbReportUnit) => !unit.leadId || leadAssignments.get(`${unit.webinarId}:${unit.leadId}`)?.[0]?.id === unit.id;

  for (const event of input.events) {
    const state = stateByUnit.get(event.unitId);
    if (!state || !state.unit.leadId || !ownsOutcomes(state.unit)) continue;
    const elapsed = event.firstOccurredAt.getTime() - state.unit.assignedAt.getTime();
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > windowMs || event.firstOccurredAt > now) continue;
    if (event.kind === "VIDEO_TICK") {
      state.viewer = true;
      state.firstPlaybackAt = earlier(state.firstPlaybackAt, event.firstOccurredAt);
      if (event.maxVideoSec !== null && Number.isFinite(event.maxVideoSec) && event.maxVideoSec >= 0) {
        state.maxVideoSec = state.maxVideoSec === null ? event.maxVideoSec : Math.max(state.maxVideoSec, event.maxVideoSec);
      }
    }
    if (event.kind === "OFFER_CLICK") { state.click = true; state.firstClickAt = earlier(state.firstClickAt, event.firstOccurredAt); }
    if (event.kind === "PITCH_REACHED") state.firstPitchAt = earlier(state.firstPitchAt, event.firstOccurredAt);
    if (event.firstPitchAt) {
      const elapsedPitch = event.firstPitchAt.getTime() - state.unit.assignedAt.getTime();
      if (Number.isFinite(elapsedPitch) && elapsedPitch >= 0 && elapsedPitch <= windowMs && event.firstPitchAt <= now) {
        state.firstPitchAt = earlier(state.firstPitchAt, event.firstPitchAt);
      }
    }
    const threshold = input.pitchAtSec[state.unit.variant];
    if (event.kind === "PITCH_REACHED" || (event.kind === "VIDEO_TICK" && threshold !== null && threshold >= 0
      && event.maxVideoSec !== null && event.maxVideoSec >= threshold)) state.pitch = true;
  }

  let unattributedSales = 0;
  let excludedCurrencySales = 0;
  const seenSaleIds = new Set<string>();
  for (const sale of input.sales) {
    if (seenSaleIds.has(sale.id) || !sale.webinarId || ![experiment.webinarAId, experiment.webinarBId].includes(sale.webinarId)) continue;
    const saleAt = sale.createdAt.getTime();
    if (startedAt === null || !Number.isFinite(saleAt) || saleAt < startedAt || saleAt > now.getTime() || saleAt > collectionEnd + windowMs) continue;
    seenSaleIds.add(sale.id);
    if (sale.currency.trim().toUpperCase() !== "BRL") { excludedCurrencySales++; continue; }
    const unit = sale.leadId ? leadAssignments.get(`${sale.webinarId}:${sale.leadId}`)?.[0] : undefined;
    if (!unit || saleAt < unit.assignedAt.getTime() || saleAt > unit.assignedAt.getTime() + windowMs) {
      unattributedSales++;
      continue;
    }
    const state = stateByUnit.get(unit.id)!;
    state.buyer = true;
    state.firstPurchaseAt = earlier(state.firstPurchaseAt, sale.createdAt);
    state.sales++;
    state.revenue += sale.amount;
  }

  const dailyCounts = new Map<string, { A: { count: number; conversions: number }; B: { count: number; conversions: number } }>();
  const dailyStart = Math.max(startedAt ?? now.getTime(), from);
  const dailyEnd = Math.min(collectionEnd, to);
  if (dailyStart <= dailyEnd) {
    const cursor = new Date(`${dateKey(new Date(dailyStart))}T00:00:00Z`);
    const last = dateKey(new Date(dailyEnd));
    while (cursor.toISOString().slice(0, 10) <= last) {
      dailyCounts.set(cursor.toISOString().slice(0, 10), { A: { count: 0, conversions: 0 }, B: { count: 0, conversions: 0 } });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const diagnosticUnits: AbDiagnosticUnit[] = [];
  for (const state of stateByUnit.values()) {
    const { unit } = state;
    if (!selectedIds.has(unit.id)) continue;
    const row = variants[unit.variant === "A" ? 0 : 1];
    row.assigned++;
    const mature = matureIds.has(unit.id);
    if (mature) row.mature++;
    else { row.pending++; if (!observed) continue; }
    if (observed) row.evaluated!++;
    row.identified += Number(Boolean(unit.leadId));
    row.viewers += Number(state.viewer);
    row.pitch += Number(state.pitch);
    row.clicks += Number(state.click);
    row.buyers += Number(state.buyer);
    row.sales += state.sales;
    row.revenueCents += state.revenue;
    const converted = experiment.metric === "PURCHASE" ? state.buyer : experiment.metric === "OFFER_CLICK" ? state.click : state.pitch;
    row.conversions += Number(converted);
    diagnosticUnits.push({ variant: unit.variant, source: unit.source, device: unit.device, campaign: unit.campaign, mature,
      converted, buyer: state.buyer, revenueCents: state.revenue, maxVideoSec: state.maxVideoSec, assignedAt: unit.assignedAt,
      firstPlaybackAt: state.firstPlaybackAt, firstPitchAt: state.firstPitchAt, firstClickAt: state.firstClickAt, firstPurchaseAt: state.firstPurchaseAt });
    const day = dailyCounts.get(dateKey(unit.assignedAt));
    if (day) { day[unit.variant].count++; day[unit.variant].conversions += Number(converted); }
  }
  for (const variant of variants) {
    const base = abMetricBase(variant);
    variant.rate = base ? variant.conversions / base : null;
    variant.interval = observed ? null : wilsonInterval(variant.conversions, variant.mature);
  }
  const statistics = compareProportions(variants[0].conversions, abMetricBase(variants[0]), variants[1].conversions, abMetricBase(variants[1]));
  if (observed) { statistics.pValue = null; statistics.interval = null; }
  const warnings: string[] = [];
  if (observed && variants.some((variant) => variant.pending > 0)) warnings.push(`Resultados parciais: incluem os eventos e compras já registrados nas entradas que ainda não completaram ${experiment.conversionWindowHours}h. As oportunidades de conversão ainda diferem e os números podem aumentar.`);
  if (experiment.mode === "OBSERVATIONAL") warnings.push("Origem, campanha e dispositivo usam o cadastro atual do acesso; esses dados podem ter mudado em uma revisita. Os públicos não foram randomizados.");
  if (input.configurationChanged) warnings.push("A configuração de uma versão mudou após o início, ou seu registro original está ausente. A comparação permanece descritiva; inicie um novo experimento com versões estáveis.");
  if (experiment.metric === "PURCHASE") warnings.push("Compras usam a atribuição registrada na integração. Vendas vinculadas por e-mail ou telefone podem ter sido atribuídas ao webinar mais recente; nenhuma atribuição é refeita neste relatório.");
  if (overlapPeople) warnings.push(`${overlapPeople} identidade(s) por e-mail aparecem nas duas versões. A comparação pode conter contaminação entre grupos.`);
  if (duplicateIdentities) warnings.push(`${duplicateIdentities} identidade(s) por acesso ou e-mail aparecem mais de uma vez na mesma versão. Todos os navegadores permanecem na base; cada acesso vinculado contribui com resultados somente na primeira alocação. Vendas não são reatribuídas por e-mail.`);
  if (unattributedSales) warnings.push(`${unattributedSales} venda(s) em reais não pertencem a uma janela elegível da coorte e não entram na conversão nem na receita comparada.`);
  if (excludedCurrencySales) warnings.push(`${excludedCurrencySales} venda(s) em outras moedas não entram nos resultados. Os valores financeiros consideram somente BRL.`);
  if (srmPValue !== null && srmPValue < 0.0005) warnings.push("A distribuição total dos navegadores difere do sorteio 50/50 esperado (SRM). O diagnóstico usa todas as alocações, sem filtros.");
  if (experiment.mode === "RANDOMIZED") warnings.push("A unidade do sorteio é o navegador. Troca de aparelho ou limpeza de cookies pode gerar outra alocação; e-mails identificados ajudam a detectar sobreposição conhecida.");
  warnings.push("Receita registrada na integração, sem dedução automática de estornos. Eventos e compras precisam ocorrer depois da entrada e dentro da janela de conversão.");

  let state: AbInferenceState;
  if (experiment.status === "DRAFT" || startedAt === null) state = "DRAFT";
  else if (experiment.mode === "OBSERVATIONAL") state = "OBSERVATIONAL";
  else if (input.configurationChanged || overlapPeople || duplicateIdentities || (srmPValue !== null && srmPValue < 0.0005)) state = "INTEGRITY";
  else if (endsAt !== null && ((completedAt !== null && completedAt < endsAt) || (interruptedAt !== null && interruptedAt < endsAt))) state = "EARLY_STOP";
  else if (Object.values(filters).some(Boolean)) state = "EXPLORATORY";
  else if (endsAt === null || now.getTime() < endsAt) state = "COLLECTING";
  else if (now.getTime() < endsAt + windowMs || variants.some((variant) => variant.pending > 0)) state = "MATURING";
  else if (variants.some((variant) => variant.mature < experiment.sampleSizePerVariant) || statistics.pValue === null) state = "INSUFFICIENT";
  else if (statistics.pValue < 0.05 && statistics.interval && statistics.interval[0] > 0) state = "WINNER_B";
  else if (statistics.pValue < 0.05 && statistics.interval && statistics.interval[1] < 0) state = "WINNER_A";
  else state = "INCONCLUSIVE";
  return {
    experiment, generatedAt: now.toISOString(), filters, readout: observed ? "OBSERVED" : "MATURE", variants,
    daily: [...dailyCounts].map(([date, day]) => ({ date, A: day.A.count ? day.A.conversions / day.A.count : null, B: day.B.count ? day.B.conversions / day.B.count : null })),
    integrity: { overlapPeople, duplicateIdentities, unattributedSales, excludedCurrencySales, srmPValue, warnings },
    inference: { state, ...inferenceDescription(state, experiment), ...statistics }, filterOptions,
    diagnostics: buildAbDiagnostics(diagnosticUnits, observed ? "OBSERVED_ENTRIES" : "MATURE_ENTRIES")
  };
}
