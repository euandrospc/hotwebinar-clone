import type { AbAudienceComparison, AbAudienceMetrics, AbExperimentDto, AbReportFilters, AbVariantKey } from "@/lib/ab-tests";
import type { AbReportUnit } from "@/lib/ab-report";
import { zonedParts, zonedToUtc } from "@/lib/timezones";

export interface AbAudienceSchedule {
  mode: "UNICO" | "JIT"; startDate: Date | null; endDate: Date | null; timezone: string;
  recurring: boolean; recurringDays: number[]; videoSyncWithStart: boolean; pitchAtSec: number | null;
}
export interface AbAudienceWindow { from: Date; to: Date }
export interface AbAudienceArmPlan { windows: AbAudienceWindow[]; pitchTargets: Date[]; reason: string | null; pitchReason: string | null }
export interface AbAudiencePlan { A: AbAudienceArmPlan; B: AbAudienceArmPlan; window?: AbAudienceComparison["window"] }
export interface AbAudienceSample { variant: AbVariantKey; observedAt: Date; online: number }
export interface AbAudienceAggregate { average: number | null; peak: number | null; peakAt: Date | null; sampleCount: number }

export function inAbAudienceWindows(at: Date, windows: readonly AbAudienceWindow[]) {
  return windows.some((window) => at >= window.from && at <= window.to);
}
function pitchTargets(schedule: AbAudienceSchedule | undefined, windows: AbAudienceWindow[], configurationChanged: boolean) {
  const unavailable = (reason: string) => ({ targets: [] as Date[], reason });
  if (!schedule) return unavailable("Não há programação registrada para localizar o instante do pitch.");
  if (configurationChanged) return unavailable("A programação foi alterada após o início; o instante original do pitch não pode ser confirmado.");
  if (schedule.mode === "JIT" || !schedule.videoSyncWithStart) return unavailable("Cada participante tem seu próprio relógio de reprodução; não existe um instante coletivo de pitch.");
  if (!schedule.startDate || schedule.pitchAtSec === null || !Number.isFinite(schedule.pitchAtSec) || schedule.pitchAtSec < 0) return unavailable("Defina início e posição do pitch em uma transmissão sincronizada.");
  if (!windows.length) return unavailable("Ainda não há janelas completas no recorte.");
  const pitchMs = schedule.pitchAtSec * 1000;
  if (schedule.endDate && schedule.startDate.getTime() + pitchMs >= schedule.endDate.getTime()) return unavailable("O pitch configurado fica fora do horário programado da transmissão.");
  const targets: Date[] = [];
  if (!schedule.recurring) {
    const target = new Date(schedule.startDate.getTime() + pitchMs);
    if (inAbAudienceWindows(target, windows)) targets.push(target);
  } else {
    let zone = schedule.timezone && schedule.timezone !== "__auto__" ? schedule.timezone : "America/Sao_Paulo";
    try { zonedParts(schedule.startDate, zone); } catch { zone = "America/Sao_Paulo"; }
    const original = zonedParts(schedule.startDate, zone);
    const first = zonedParts(new Date(windows[0].from.getTime() - pitchMs), zone);
    const last = zonedParts(windows[windows.length - 1].to, zone);
    const lastDay = Date.UTC(last.y, last.mo, last.d);
    for (let day = Date.UTC(first.y, first.mo, first.d); day <= lastDay; day += 86_400_000) {
      const date = new Date(day);
      if (!schedule.recurringDays.includes(date.getUTCDay())) continue;
      const occurrence = zonedToUtc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), original.h, original.mi, original.s, zone);
      if (occurrence < schedule.startDate) continue;
      const target = new Date(occurrence.getTime() + pitchMs);
      if (inAbAudienceWindows(target, windows)) targets.push(target);
    }
  }
  return { targets, reason: targets.length ? null : "Nenhum instante programado de pitch está nas janelas selecionadas." };
}

/** Audience snapshots have no person/UTM dimension. Their totals must never be presented as experimental-cohort concurrency. */
export function createAbAudiencePlan(input: {
  experiment: AbExperimentDto; units: readonly AbReportUnit[]; filters?: AbReportFilters; now: Date;
  schedules?: Partial<Record<AbVariantKey, AbAudienceSchedule>>; configurationChanged?: boolean;
}): AbAudiencePlan {
  const { experiment, units, now } = input;
  const observed = experiment.mode === "OBSERVATIONAL";
  const filters = input.filters ?? {};
  const keys = ["source", "medium", "campaign", "content", "device"] as const;
  const scoped = keys.some((key) => Boolean(filters[key]));
  const windowMs = experiment.conversionWindowHours * 3_600_000;
  const startedAt = experiment.startedAt ? new Date(experiment.startedAt).getTime() : Infinity;
  const endedAt = Math.min(experiment.endsAt ? new Date(experiment.endsAt).getTime() : now.getTime(),
    experiment.mode === "RANDOMIZED" && experiment.completedAt ? new Date(experiment.completedAt).getTime() : Infinity, now.getTime());
  const from = filters.from ? new Date(filters.from).getTime() : -Infinity;
  const to = filters.to ? new Date(filters.to).getTime() : Infinity;
  const arm = (variant: AbVariantKey): AbAudienceArmPlan => {
    const windows: AbAudienceWindow[] = [];
    const expectedWebinar = variant === "A" ? experiment.webinarAId : experiment.webinarBId;
    const selected = units.filter((unit) => unit.variant === variant && unit.webinarId === expectedWebinar
      && unit.assignedAt.getTime() >= startedAt && unit.assignedAt.getTime() <= endedAt
      && unit.assignedAt.getTime() >= from && unit.assignedAt.getTime() <= to
      && (observed || unit.assignedAt.getTime() + windowMs <= now.getTime())
      && keys.every((key) => !filters[key] || (unit[key]?.trim() || "__unknown__") === filters[key]))
      .sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime());
    for (const unit of selected) {
      const end = new Date(Math.min(unit.assignedAt.getTime() + windowMs, now.getTime())), last = windows.at(-1);
      if (last && unit.assignedAt <= last.to) { if (end > last.to) last.to = end; }
      else windows.push({ from: unit.assignedAt, to: end });
    }
    const reason = scoped ? "O histórico de simultâneos é agregado por webinar e não permite aplicar filtros de origem, campanha ou dispositivo."
      : !windows.length ? observed ? "Ainda não há entradas observadas no recorte." : "Ainda não há entradas com janela completa no recorte." : null;
    const pitch = pitchTargets(input.schedules?.[variant], windows, Boolean(input.configurationChanged));
    return { windows, pitchTargets: reason ? [] : pitch.targets, reason, pitchReason: reason ?? pitch.reason };
  };
  return { A: arm("A"), B: arm("B"), window: observed ? "OBSERVED_COHORT_WINDOWS" : "MATURE_COHORT_WINDOWS" };
}

export function assembleAbAudience(plan: AbAudiencePlan, aggregates: Partial<Record<AbVariantKey, AbAudienceAggregate>>, samples: readonly AbAudienceSample[]): AbAudienceComparison {
  const arm = (variant: AbVariantKey): AbAudienceMetrics => {
    const data = plan[variant];
    const aggregate = !data.reason ? aggregates[variant] : undefined;
    const valid = samples.filter((sample) => sample.variant === variant && Number.isSafeInteger(sample.online) && sample.online >= 0
      && inAbAudienceWindows(sample.observedAt, data.windows));
    const points = data.reason ? [] : data.pitchTargets.flatMap((target) => {
      const closest = valid.filter((sample) => Math.abs(sample.observedAt.getTime() - target.getTime()) <= 15_000)
        .sort((a, b) => Math.abs(a.observedAt.getTime() - target.getTime()) - Math.abs(b.observedAt.getTime() - target.getTime()) || a.observedAt.getTime() - b.observedAt.getTime())[0];
      return closest ? [{ scheduledAt: target.toISOString(), observedAt: closest.observedAt.toISOString(), online: closest.online }] : [];
    });
    return {
      from: data.windows[0]?.from.toISOString() ?? null, to: data.windows.at(-1)?.to.toISOString() ?? null,
      average: aggregate?.sampleCount ? aggregate.average : null, peak: aggregate?.sampleCount ? aggregate.peak : null,
      peakAt: aggregate?.sampleCount ? aggregate.peakAt?.toISOString() ?? null : null, sampleCount: aggregate?.sampleCount ?? 0,
      reason: data.reason ?? (!aggregate?.sampleCount ? "Não há amostras de audiência registradas nessas janelas. Ausência de leitura não significa audiência zero." : null),
      pitch: { average: points.length ? points.reduce((sum, point) => sum + point.online, 0) / points.length : null,
        peak: points.length ? Math.max(...points.map((point) => point.online)) : null,
        sampleCount: points.length, occurrenceCount: data.pitchTargets.length, points,
        reason: data.pitchReason ?? (!points.length ? "Nenhuma leitura foi observada até 15 segundos do instante programado do pitch."
          : points.length < data.pitchTargets.length ? `${points.length} de ${data.pitchTargets.length} ocorrências têm leitura próxima ao pitch; as lacunas não foram preenchidas.` : null) }
    };
  };
  return { scope: "WEBINAR_TOTAL", window: plan.window ?? "MATURE_COHORT_WINDOWS", cadenceSeconds: 15, A: arm("A"), B: arm("B") };
}

/** Used by deterministic local fixtures and tests; production aggregates snapshots in SQL. */
export function buildAbAudienceFromSamples(plan: AbAudiencePlan, samples: readonly AbAudienceSample[]): AbAudienceComparison {
  const aggregates: Partial<Record<AbVariantKey, AbAudienceAggregate>> = {};
  for (const variant of ["A", "B"] as const) {
    const valid = samples.filter((sample) => sample.variant === variant && Number.isSafeInteger(sample.online) && sample.online >= 0
      && inAbAudienceWindows(sample.observedAt, plan[variant].windows));
    const peak = [...valid].sort((a, b) => b.online - a.online || a.observedAt.getTime() - b.observedAt.getTime())[0];
    aggregates[variant] = { average: valid.length ? valid.reduce((sum, sample) => sum + sample.online, 0) / valid.length : null,
      peak: peak?.online ?? null, peakAt: peak?.observedAt ?? null, sampleCount: valid.length };
  }
  return assembleAbAudience(plan, aggregates, samples);
}
