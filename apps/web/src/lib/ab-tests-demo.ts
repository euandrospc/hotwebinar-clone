import { buildAbReport, type AbReportEvent, type AbReportSale, type AbReportUnit } from "@/lib/ab-report";
import { calculateSampleSize } from "@/lib/ab-statistics";
import type { AbExperimentDto, AbReport, AbReportFilters, AbVariantConfiguration, AbVariantKey, AbWebinarOption } from "@/lib/ab-tests";
import { buildAbAudienceFromSamples, createAbAudiencePlan, type AbAudienceSample, type AbAudienceSchedule } from "@/lib/ab-audience";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const COMPLETED_ID = "demo-ab-novo-pitch";
const RUNNING_ID = "demo-ab-chamada-oferta";
const HISTORICAL_ID = "demo-ab-comparacao-webinars";
const SCHEDULE_ID = "demo-ab-horario-19h-21h";

/** Fail closed outside a local development request, even if a demo query is supplied. */
export function isAbTestsDemoEnabled(mode: string | undefined, environment: string | undefined, host: string | null): boolean {
  if (environment !== "development" || mode === "0" || !host) return false;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return false;
  try {
    const url = new URL(`http://${host}`);
    return !url.port || Number(url.port) > 0;
  } catch { return false; }
}

const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
});
function dayStart(now: Date): number {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid demo date");
  const parts = calendar.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00-03:00`).getTime();
}

function webinar(key: string, title: string): AbWebinarOption {
  // No public slug: fixtures must never masquerade as a runnable transmission.
  return { id: `demo-ab-webinar-${key}`, name: title, title, slug: null, status: "ACTIVE", mode: "JIT" };
}

/** Relative calendar dates keep the local preview useful without fixtures in the database. */
export function createAbTestsDemo(now = new Date()): { experiments: AbExperimentDto[]; webinars: AbWebinarOption[] } {
  const today = dayStart(now);
  const webinars = [
    webinar("original", "IA na prática · pitch original"),
    webinar("novo-pitch", "IA na prática · novo pitch"),
    webinar("oferta-direta", "IA na prática · oferta direta"),
    webinar("automacoes", "Automações que economizam tempo"),
    { ...webinar("horario-19h", "IA na prática · sessão às 19h"), mode: "UNICO" as const },
    { ...webinar("horario-21h", "IA na prática · sessão às 21h"), mode: "UNICO" as const }
  ];
  const make = (input: Partial<AbExperimentDto> & Pick<AbExperimentDto, "id" | "name" | "hypothesis">): AbExperimentDto => {
    const start = today - 18 * DAY_MS;
    const end = start + 14 * DAY_MS;
    const experiment: AbExperimentDto = {
      mode: "RANDOMIZED", status: "COMPLETED", metric: "PURCHASE",
      webinarAId: webinars[0].id, webinarBId: webinars[1].id, webinarA: webinars[0], webinarB: webinars[1],
      baselineRate: .1, minimumDetectableLift: .2, sampleSizePerVariant: calculateSampleSize(.1, .2),
      durationDays: 14, conversionWindowHours: 72,
      startedAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
      completedAt: new Date(end).toISOString(), interruptedAt: null,
      createdAt: new Date(start - DAY_MS).toISOString(), updatedAt: new Date(end).toISOString(),
      assignmentCount: 8700, publicPath: null, ...input
    };
    const configuration = (variant: AbVariantKey): AbVariantConfiguration => {
      const scheduled = experiment.id === SCHEDULE_ID;
      const selected = variant === "A" ? experiment.webinarA : experiment.webinarB;
      const startAt = scheduled ? new Date(start + (variant === "A" ? 19 : 21) * HOUR_MS).toISOString() : null;
      return { version: 1, title: selected.title, mode: selected.mode, timezone: "America/Sao_Paulo", startAt,
        endAt: startAt ? new Date(new Date(startAt).getTime() + 90 * 60_000).toISOString() : null,
        recurring: scheduled, recurringDays: scheduled ? [0, 1, 2, 3, 4, 5, 6] : [],
        videoName: "IA na prática · apresentação completa", videoDurationSec: 3600,
        pitchAtSec: scheduled || variant === "A" ? 2160 : 1740, videoSyncWithStart: scheduled,
        offerTitle: "Maestr.IA · acesso à formação", offerPriceOriginal: "997,00", offerPriceFinal: experiment.id === RUNNING_ID ? "297,00" : "497,00",
        offerShowAtSec: 2520, offerHideAtSec: null, offerLink: null, offerDisabled: false,
        offerButtonText: experiment.id === RUNNING_ID && variant === "B" ? "Quero começar agora" : "Quero participar",
        offerPassUtms: true, accessFacilitated: false, fields: { name: true, email: true, phone: false }, chatAiEnabled: true,
        chatAiName: "Equipe Bravy", audienceMode: "NONE" };
    };
    experiment.configuration = { A: configuration("A"), B: configuration("B"), frozen: experiment.mode === "RANDOMIZED" };
    return experiment;
  };
  return { webinars, experiments: [
    make({
      id: COMPLETED_ID, name: "Novo pitch × pitch original",
      testVariable: "PITCH", variantADescription: "Apresentação dos recursos antes do resultado, pitch aos 36 minutos.",
      variantBDescription: "Resultado antes dos recursos, pitch aos 29 minutos.",
      hypothesis: "Apresentar o resultado antes dos recursos aumenta a conversão em compra."
    }),
    make({
      id: RUNNING_ID, name: "Convite direto para a oferta",
      testVariable: "OFFER", variantADescription: "Chamada atual: Quero participar.", variantBDescription: "Chamada direta: Quero começar agora.",
      hypothesis: "Uma chamada mais objetiva incentiva mais visitantes a conhecer a oferta.",
      status: "RUNNING", metric: "OFFER_CLICK", webinarBId: webinars[2].id, webinarB: webinars[2],
      baselineRate: .24, minimumDetectableLift: .15, sampleSizePerVariant: calculateSampleSize(.24, .15),
      startedAt: new Date(today - 7 * DAY_MS).toISOString(), endsAt: new Date(today + 7 * DAY_MS).toISOString(),
      completedAt: null, createdAt: new Date(today - 8 * DAY_MS).toISOString(),
      updatedAt: new Date(today - 7 * DAY_MS).toISOString(), assignmentCount: 2438
    }),
    make({
      id: HISTORICAL_ID, name: "IA na prática × Automações",
      testVariable: "FULL_WEBINAR", variantADescription: "Webinar sobre aplicações práticas de IA.", variantBDescription: "Webinar sobre automação do trabalho.",
      hypothesis: "Comparar os assuntos e as origens de tráfego para planejar o próximo experimento.",
      mode: "OBSERVATIONAL", webinarBId: webinars[3].id, webinarB: webinars[3],
      createdAt: new Date(today - 2 * DAY_MS).toISOString(), updatedAt: new Date(today - DAY_MS).toISOString(),
      completedAt: new Date(today - DAY_MS).toISOString(), assignmentCount: 0
    }),
    make({ id: SCHEDULE_ID, name: "Sessão às 19h × sessão às 21h", testVariable: "SCHEDULE",
      hypothesis: "Transmitir às 21h facilita a presença do público após o expediente, mantendo vídeo e oferta.",
      variantADescription: "Mesma apresentação e oferta, transmissão sincronizada às 19h.",
      variantBDescription: "Mesma apresentação e oferta, transmissão sincronizada às 21h.",
      webinarAId: webinars[4].id, webinarBId: webinars[5].id, webinarA: webinars[4], webinarB: webinars[5], assignmentCount: 8700 })
  ] };
}

/** A stable integer mixer; unrelated attributes use separate salts. No Math.random or clock reads. */
function fraction(index: number, salt: number): number {
  let value = (index + salt) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function dailyVolumes(total: number, days: number, arm: AbVariantKey): number[] {
  const weekly = [.84, 1.08, 1.14, 1.03, 1.18, .98, .79];
  const weights = Array.from({ length: days }, (_, i) => weekly[i % 7] * (1 + .014 * i + (arm === "B" ? .025 * Math.sin(i) : 0)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map(weight => total * weight / sum);
  const counts = exact.map(Math.floor);
  const order = exact.map((count, i) => ({ i, remainder: count - counts[i] })).sort((a, b) => b.remainder - a.remainder);
  for (let i = 0, remaining = total - counts.reduce((a, b) => a + b, 0); i < remaining; i++) counts[order[i].i]++;
  return counts;
}

/** Run synthetic entrants through the same cohort/statistics engine used by real reports. */
export function getAbTestsDemoReport(experiment: AbExperimentDto, filters: AbReportFilters = {}, now = new Date()): AbReport {
  const units: AbReportUnit[] = [];
  const events: AbReportEvent[] = [];
  const sales: AbReportSale[] = [];
  const running = experiment.id === RUNNING_ID;
  const historical = experiment.id === HISTORICAL_ID;
  const scheduled = experiment.id === SCHEDULE_ID;
  const known = running || historical || scheduled || experiment.id === COMPLETED_ID;
  const days = running ? 7 : 14;
  const amounts = historical ? [1584, 1416] : running ? [1210, 1228] : [4328, 4372];
  const start = experiment.startedAt ? new Date(experiment.startedAt).getTime() : null;
  const pitchAtSec = { A: experiment.configuration?.A.pitchAtSec ?? 2160, B: experiment.configuration?.B.pitchAtSec ?? 1740 };
  // Drafts and tests created in the preview start empty, just like a real test.
  if (known && experiment.status !== "DRAFT" && start !== null) {
    for (const arm of ["A", "B"] as const) {
      const webinarId = arm === "A" ? experiment.webinarAId : experiment.webinarBId;
      const volumes = dailyVolumes(amounts[arm === "A" ? 0 : 1], days, arm);
      let ordinal = 0;
      for (let day = 0; day < days; day++) {
        for (let index = 0; index < volumes[day]; index++, ordinal++) {
          const seed = ordinal + (arm === "B" ? 90001 : 10001) + (running ? 200000 : historical ? 400000 : 0);
          const id = `${experiment.id}-${arm}-${ordinal}`;
          const at = new Date(start + day * DAY_MS + (scheduled ? 16 : 8) * HOUR_MS + Math.floor(fraction(seed, 3) * (scheduled ? 2.75 : 14) * HOUR_MS));
          const channel = fraction(seed, 173);
          const source = channel < .58 ? "meta" : channel < .86 ? "google" : "organico";
          const deviceShare = fraction(seed, 541);
          const device = deviceShare < .73 ? "mobile" : deviceShare < .96 ? "desktop" : "tablet";
          const score = historical && ordinal < 8 ? Math.min(.7, fraction(seed, 91)) : fraction(seed, 91);
          const identified = historical || score < (arm === "A" ? .939 : .95);
          const leadId = identified ? `demo-ab-lead-${id}` : null;
          const sourceGain = source === "organico" ? .012 : source === "google" ? .004 : -.006;
          const dailyGain = .008 * Math.sin(day * .75) + .002 * Math.cos(day * 1.6);
          const purchaseRate = (arm === "A" ? .101 : historical ? .118 : .135) + sourceGain + dailyGain + (device === "desktop" ? .004 : 0);
          const clickRate = (arm === "A" ? .247 : running ? .304 : .292) + sourceGain + dailyGain * 2;
          units.push({
            id, variant: arm, webinarId, leadId, assignedAt: at,
            email: !identified ? null : historical && ordinal < 8 ? `shared-demo-${ordinal}@example.test` : `${id}@example.test`,
            source, medium: source === "organico" ? "organic" : "cpc",
            campaign: source === "organico" ? "conteudo-organico" : fraction(seed, 817) < .68 ? "webinar-ia-pratica" : "remarketing-aula",
            content: source === "organico" ? "newsletter" : ["video-caso-real", "carrossel-beneficios", "depoimento-aluno"][Math.floor(fraction(seed, 1223) * 3)],
            device
          });
          const addEvent = (kind: AbReportEvent["kind"], offsetMinutes: number, maxVideoSec: number | null = null) => {
            events.push({ unitId: id, kind, firstOccurredAt: new Date(at.getTime() + offsetMinutes * 60_000), maxVideoSec });
          };
          if (!identified) continue;
          addEvent("OPTIN", 2);
          const sessionStart = start + day * DAY_MS + (arm === "A" ? 19 : 21) * HOUR_MS;
          const scheduledOffsetMinutes = scheduled ? (sessionStart - at.getTime()) / 60_000 : 0;
          const reachedPitch = score < (arm === "A" ? .61 : .67) + dailyGain;
          if (score < (arm === "A" ? .809 : .836)) {
            // Synthetic maxima span absolute video positions; these values do
            // not represent contiguous watch time or an observed retention path.
            const videoEndSec = arm === "A" ? 3600 : 3300;
            const depth = fraction(seed, 1597);
            const maximum = reachedPitch
              ? Math.round(pitchAtSec[arm] + (videoEndSec - pitchAtSec[arm]) * (depth > .9 ? 1 : depth))
              : Math.round(30 + (pitchAtSec[arm] - 90) * depth);
            addEvent("VIDEO_TICK", scheduled ? scheduledOffsetMinutes + 1 : 14, maximum);
          }
          if (reachedPitch) addEvent("PITCH_REACHED", scheduled ? scheduledOffsetMinutes + pitchAtSec[arm] / 60 : pitchAtSec[arm] / 60);
          if (score < clickRate) addEvent("OFFER_CLICK", scheduled ? scheduledOffsetMinutes + 43 : 43);
          if (score < purchaseRate) {
            const purchasedAt = scheduled ? new Date(sessionStart + 45 * 60_000 + fraction(seed, 2213) * 2 * HOUR_MS)
              : new Date(at.getTime() + Math.min(2 + fraction(seed, 2213) * 20, experiment.conversionWindowHours * .8) * HOUR_MS);
            sales.push({ id: `${id}-sale`, webinarId, leadId, amount: running ? 29_700 : 49_700, currency: "BRL", createdAt: purchasedAt });
            // Some buyers add an extra product; orders and buyers remain distinct metrics.
            if (ordinal % 17 === 0) sales.push({ id: `${id}-bump`, webinarId, leadId, amount: 9_700, currency: "BRL", createdAt: purchasedAt });
          }
        }
      }
    }
  }
  const report = buildAbReport({ experiment, units, events, sales, pitchAtSec, filters, now });
  const schedules: Partial<Record<AbVariantKey, AbAudienceSchedule>> = {};
  for (const variant of ["A", "B"] as const) {
    const configuration = experiment.configuration?.[variant];
    if (configuration) schedules[variant] = { mode: configuration.mode, startDate: configuration.startAt ? new Date(configuration.startAt) : null,
      endDate: configuration.endAt ? new Date(configuration.endAt) : null, timezone: configuration.timezone,
      recurring: configuration.recurring, recurringDays: configuration.recurringDays,
      videoSyncWithStart: configuration.videoSyncWithStart, pitchAtSec: configuration.pitchAtSec };
  }
  const audiencePlan = createAbAudiencePlan({ experiment, units, filters, now, schedules });
  const samples: AbAudienceSample[] = [];
  // Independent synthetic snapshot series, never reconstructed by adding entrants.
  if (known && start !== null && experiment.status !== "DRAFT") {
    for (const variant of ["A", "B"] as const) for (let day = 0; day < days + Math.ceil(experiment.conversionWindowHours / 24); day++) {
      const sessionStart = start + day * DAY_MS + (scheduled ? variant === "A" ? 19 : 21 : 19) * HOUR_MS;
      const durationSec = scheduled ? 5400 : 7200;
      const amplitude = (variant === "A" ? 190 : scheduled ? 238 : 216) * (.9 + fraction(day, 4051) * .2);
      for (let seconds = 0; seconds < durationSec; seconds += 15) {
        const shape = Math.sin(Math.PI * seconds / durationSec) ** .65;
        samples.push({ variant, observedAt: new Date(sessionStart + seconds * 1000), online: Math.round(amplitude * shape) });
      }
    }
  }
  report.diagnostics!.audience = buildAbAudienceFromSamples(audiencePlan, samples);
  return report;
}
