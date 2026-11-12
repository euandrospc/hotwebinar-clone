/** Shared wire contract for experiment management and cohort-based reporting. */
export type AbMode = "OBSERVATIONAL" | "RANDOMIZED";
export type AbStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";
export type AbMetric = "PURCHASE" | "OFFER_CLICK" | "PITCH_REACHED";
export type AbVariantKey = "A" | "B";
export interface AbWebinarOption {
  id: string; title: string; name: string; slug: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"; mode: "UNICO" | "JIT";
}
export interface AbExperimentDto {
  id: string; name: string; hypothesis: string; mode: AbMode; status: AbStatus; metric: AbMetric;
  testVariable?: AbTestVariable; variantADescription?: string; variantBDescription?: string;
  configuration?: { A: AbVariantConfiguration; B: AbVariantConfiguration; frozen: boolean };
  webinarAId: string; webinarBId: string; webinarA: AbWebinarOption; webinarB: AbWebinarOption;
  baselineRate: number; minimumDetectableLift: number; sampleSizePerVariant: number;
  durationDays: number; conversionWindowHours: number;
  startedAt: string | null; endsAt: string | null; completedAt: string | null;
  /** First unplanned interruption; retained after resume to prevent optional stopping. */
  interruptedAt?: string | null;
  createdAt: string; updatedAt: string; assignmentCount: number; publicPath: string | null;
}
export interface AbReportFilters {
  from?: string; to?: string; source?: string; medium?: string;
  campaign?: string; content?: string; device?: string;
}
export interface AbVariantReport {
  key: AbVariantKey; webinarId: string; label: string;
  /** Randomized browsers, or identified accesses for an observational comparison. */
  assigned: number;
  /** Actual units with a complete conversion window, independent of readout. */
  mature: number; pending: number; identified: number; viewers: number;
  /** Outcome denominator: all observed entries, or only mature randomized units. */
  evaluated?: number;
  pitch: number; clicks: number; buyers: number; sales: number; revenueCents: number;
  conversions: number; rate: number | null; interval: [number, number] | null;
}
export type AbInferenceState = "DRAFT" | "OBSERVATIONAL" | "EXPLORATORY" | "COLLECTING" | "MATURING" | "INSUFFICIENT" | "INTEGRITY" | "EARLY_STOP" | "WINNER_A" | "WINNER_B" | "INCONCLUSIVE";
export type AbDiagnosticDimension = "source" | "device" | "campaign";
/** Descriptive counts from the same filtered/evaluated cohort as the report. */
export interface AbSegmentMetrics {
  mature: number; conversions: number; buyers: number; revenueCents: number;
  /** Entries evaluated in this segment; may include pending observational entries. */
  entries?: number;
  conversionRate: number | null; purchaseRate: number | null; revenuePerEntryCents: number | null;
}
export interface AbSegmentRow { value: string; A: AbSegmentMetrics; B: AbSegmentMetrics }
export interface AbPositionReachPoint {
  seconds: number;
  A: { count: number; rate: number | null };
  B: { count: number; rate: number | null };
}
export interface AbLatencyMetric { medianSeconds: number | null; averageSeconds: number | null; samples: number }
export interface AbTimingMetrics {
  positionSamples: number; meanMaxVideoSec: number | null; medianMaxVideoSec: number | null;
  firstPlayback: AbLatencyMetric; firstPitch: AbLatencyMetric; firstClick: AbLatencyMetric; firstPurchase: AbLatencyMetric;
}
export interface AbAudienceMetrics {
  from: string | null; to: string | null; average: number | null; peak: number | null; peakAt: string | null;
  sampleCount: number; reason: string | null;
  pitch: {
    average: number | null; peak: number | null; sampleCount: number; occurrenceCount: number; reason: string | null;
    points: { scheduledAt: string; observedAt: string; online: number }[];
  };
}
export interface AbAudienceComparison {
  scope: "WEBINAR_TOTAL"; window: "MATURE_COHORT_WINDOWS" | "OBSERVED_COHORT_WINDOWS"; cadenceSeconds: 15;
  A: AbAudienceMetrics; B: AbAudienceMetrics;
}
export interface AbReportDiagnostics {
  position: {
    basis: "MATURE_ENTRIES" | "OBSERVED_ENTRIES";
    mature: { A: number; B: number };
    /** Entries evaluated for reach; maturity remains separately available above. */
    entries?: { A: number; B: number };
    /** Evaluated entrants with a valid VIDEO_TICK maximum recorded inside their window. */
    measured: { A: number; B: number };
    /** Recorded maximum >= seconds; this is not continuous watched time or retention. */
    points: AbPositionReachPoint[];
  };
  /** Exploration only: no hypothesis tests or winners within segments. */
  segments: { dimension: AbDiagnosticDimension; rows: AbSegmentRow[] }[];
  timing?: {
    timeZone: "America/Sao_Paulo"; hours: AbSegmentRow[]; weekdays: AbSegmentRow[];
    A: AbTimingMetrics; B: AbTimingMetrics;
  };
  /** Contextual total webinar audience, never a simultaneous count of experimental visitors. */
  audience?: AbAudienceComparison;
}
export interface AbReport {
  experiment: AbExperimentDto; generatedAt: string; filters: AbReportFilters;
  /** Observational readings include outcomes already recorded in pending windows. */
  readout?: "MATURE" | "OBSERVED";
  variants: [AbVariantReport, AbVariantReport];
  daily: { date: string; A: number | null; B: number | null }[];
  integrity: {
    overlapPeople: number; duplicateIdentities: number; unattributedSales: number;
    excludedCurrencySales: number; srmPValue: number | null; warnings: string[];
  };
  inference: {
    state: AbInferenceState; title: string; detail: string;
    delta: number | null; relativeLift: number | null; interval: [number, number] | null; pValue: number | null;
  };
  filterOptions: { source: string[]; medium: string[]; campaign: string[]; content: string[]; device: string[] };
  /** Optional for compatibility with previously saved responses and consumers. */
  diagnostics?: AbReportDiagnostics;
}

/** Also supports saved responses created before explicit readout denominators. */
export function abMetricBase(variant: AbVariantReport): number {
  return variant.evaluated ?? variant.mature;
}
export const AB_METRIC_LABELS: Record<AbMetric, string> = {
  PURCHASE: "Compra", OFFER_CLICK: "Clique na oferta", PITCH_REACHED: "Chegada ao pitch"
};
export const AB_STATUS_LABELS: Record<AbStatus, string> = {
  DRAFT: "Rascunho", RUNNING: "Em andamento", PAUSED: "Pausado", COMPLETED: "Encerrado"
};

export const AB_TEST_VARIABLE_LABELS = {
  FULL_WEBINAR: "Webinar completo", SCHEDULE: "Horário e programação", CONTENT: "Vídeo, abertura e conteúdo",
  PITCH: "Pitch e momento da apresentação", OFFER: "Oferta, preço e chamada para ação",
  PAGE: "Página, formulário e acesso", CHAT: "Atendimento e experiência"
} as const;
export type AbTestVariable = keyof typeof AB_TEST_VARIABLE_LABELS;
export interface AbVariantConfiguration {
  version: 1; title: string; mode: "UNICO" | "JIT"; timezone: string;
  startAt: string | null; endAt: string | null; recurring: boolean; recurringDays: number[];
  videoName: string | null; videoDurationSec: number | null; pitchAtSec: number | null; videoSyncWithStart: boolean;
  offerTitle: string; offerPriceOriginal: string | null; offerPriceFinal: string | null;
  offerShowAtSec: number | null; offerHideAtSec: number | null; offerLink: string | null; offerDisabled: boolean;
  offerButtonText: string; offerPassUtms: boolean; accessFacilitated: boolean;
  fields: { name: boolean; email: boolean; phone: boolean }; chatAiEnabled: boolean; chatAiName: string;
  audienceMode: string;
}
