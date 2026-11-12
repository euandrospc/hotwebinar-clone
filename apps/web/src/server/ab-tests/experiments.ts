import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma, Prisma } from "db";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";
import { AB_TEST_VARIABLE_LABELS, type AbExperimentDto, type AbTestVariable } from "@/lib/ab-tests";
import { calculateSampleSize } from "@/lib/ab-statistics";
import { computePhase, withOccurrence } from "@/lib/sync";
import { webinarFingerprint } from "./webinar-fingerprint";
import { abReadinessIssues } from "./readiness";
import { abConfigurationSelect, readAbConfigurationSnapshot, snapshotAbConfiguration } from "./configuration";

export const AB_RESPONSE_HEADERS = { "cache-control": "private, no-store" };
export class AbTestError extends Error {
  constructor(public code: string, public status: number, message = code) { super(message); this.name = "AbTestError"; }
}

export function abErrorResponse(error: unknown) {
  const known = error instanceof AbTestError;
  return NextResponse.json({ error: known ? error.code : "ab_unavailable", message: known ? error.message : "Não foi possível carregar o teste. Tente novamente." }, {
    status: known ? error.status : 500, headers: AB_RESPONSE_HEADERS
  });
}

export function isAbSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password || !["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.origin === new URL(request.url).origin) return true;
    return Boolean(process.env.BETTER_AUTH_URL && parsed.origin === new URL(process.env.BETTER_AUTH_URL).origin);
  } catch { return false; }
}

export async function requireAbAdmin(request: Request, mutation = false): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AbTestError("unauthorized", 401, "Entre na sua conta para continuar.");
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) throw new AbTestError("forbidden", 403, "Acesso restrito à administração.");
  if (mutation && !isAbSameOrigin(request)) throw new AbTestError("invalid_origin", 403, "Origem da solicitação inválida.");
  return session.user.id;
}

const webinarSelect = { id: true, title: true, name: true, slug: true, status: true, mode: true } as const;
export const experimentInclude = {
  webinarA: { select: { ...webinarSelect, ...abConfigurationSelect } }, webinarB: { select: { ...webinarSelect, ...abConfigurationSelect } }, _count: { select: { assignments: true } }
} satisfies Prisma.AbExperimentInclude;
type ExperimentRow = Prisma.AbExperimentGetPayload<{ include: typeof experimentInclude }>;

export function serializeExperiment(row: ExperimentRow): AbExperimentDto {
  const frozenA = readAbConfigurationSnapshot(row.webinarASnapshot), frozenB = readAbConfigurationSnapshot(row.webinarBSnapshot);
  const option = (w: ExperimentRow["webinarA"]) => ({ id: w.id, title: w.title, name: w.name, slug: w.slug, status: w.status, mode: w.mode });
  return {
    id: row.id, name: row.name, hypothesis: row.hypothesis, mode: row.mode, status: row.status, metric: row.metric,
    testVariable: row.testVariable in AB_TEST_VARIABLE_LABELS ? row.testVariable as AbTestVariable : "FULL_WEBINAR",
    variantADescription: row.variantADescription ?? "", variantBDescription: row.variantBDescription ?? "",
    configuration: { A: frozenA ?? snapshotAbConfiguration(row.webinarA), B: frozenB ?? snapshotAbConfiguration(row.webinarB), frozen: Boolean(frozenA && frozenB) },
    webinarAId: row.webinarAId, webinarBId: row.webinarBId, webinarA: option(row.webinarA), webinarB: option(row.webinarB),
    baselineRate: row.baselineRate, minimumDetectableLift: row.minimumDetectableLift, sampleSizePerVariant: row.sampleSizePerVariant,
    durationDays: row.durationDays, conversionWindowHours: row.conversionWindowHours,
    startedAt: row.startedAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null, interruptedAt: row.interruptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    assignmentCount: row._count.assignments, publicPath: row.mode === "RANDOMIZED" ? `/ab/${row.id}` : null
  };
}

const idSchema = z.string().trim().min(1).max(128);
const planShape = {
  name: z.string().trim().min(3, "Informe um nome com pelo menos três caracteres.").max(120),
  hypothesis: z.string().trim().max(2000).default(""),
  testVariable: z.enum(["FULL_WEBINAR", "SCHEDULE", "CONTENT", "PITCH", "OFFER", "PAGE", "CHAT"]).default("FULL_WEBINAR"),
  variantADescription: z.string().trim().max(1000).default(""),
  variantBDescription: z.string().trim().max(1000).default(""),
  webinarAId: idSchema, webinarBId: idSchema,
  metric: z.enum(["PURCHASE", "OFFER_CLICK", "PITCH_REACHED"]).default("PURCHASE"),
  baselineRate: z.number().finite().min(0.0001).max(0.95).default(0.05),
  minimumDetectableLift: z.number().finite().min(0.01).max(5).default(0.2),
  durationDays: z.number().int().min(7).max(90).default(14),
  conversionWindowHours: z.union([z.literal(24), z.literal(72), z.literal(168)]).default(72)
};
export const createExperimentSchema = z.object({
  ...planShape, mode: z.enum(["OBSERVATIONAL", "RANDOMIZED"]),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional()
}).strict();
const editSchema = z.object({ action: z.literal("edit"), ...planShape }).strict();
const transitionSchema = z.object({ action: z.enum(["start", "pause", "resume", "complete"]) }).strict();
const conversionWindowSchema = z.object({
  action: z.literal("conversion_window"),
  conversionWindowHours: z.union([z.literal(24), z.literal(72), z.literal(168)])
}).strict();
const updateSchema = z.union([editSchema, transitionSchema, conversionWindowSchema]);
type Plan = z.infer<typeof editSchema>;

function parsed<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AbTestError("invalid_input", 400, result.error.issues[0]?.message ?? "Configuração inválida.");
  return result.data;
}

function planData(input: Omit<Plan, "action">) {
  if (input.webinarAId === input.webinarBId) throw new AbTestError("same_webinar", 400, "Escolha dois webinars diferentes.");
  let sampleSizePerVariant: number;
  try { sampleSizePerVariant = calculateSampleSize(input.baselineRate, input.minimumDetectableLift); }
  catch { throw new AbTestError("invalid_sample_plan", 400, "A conversão esperada com a melhoria deve ficar abaixo de 100%."); }
  if (!Number.isSafeInteger(sampleSizePerVariant) || sampleSizePerVariant > 2_000_000_000) {
    throw new AbTestError("invalid_sample_plan", 400, "A amostra calculada é muito grande; revise a taxa base e a melhoria mínima.");
  }
  return {
    name: input.name, hypothesis: input.hypothesis, webinarAId: input.webinarAId, webinarBId: input.webinarBId,
    testVariable: input.testVariable, variantADescription: input.variantADescription, variantBDescription: input.variantBDescription,
    metric: input.metric, baselineRate: input.baselineRate, minimumDetectableLift: input.minimumDetectableLift,
    sampleSizePerVariant, durationDays: input.durationDays, conversionWindowHours: input.conversionWindowHours
  };
}

async function ownedWebinars(tx: Prisma.TransactionClient, ownerId: string, a: string, b: string) {
  const webinars = await tx.webinar.findMany({ where: { ownerId, id: { in: [a, b] } }, include: { video: { select: { name: true, status: true, hlsUrl: true, durationSec: true } } } });
  const webinarA = webinars.find((w) => w.id === a), webinarB = webinars.find((w) => w.id === b);
  if (!webinarA || !webinarB) throw new AbTestError("webinar_not_found", 404, "Um dos webinars não está disponível nesta conta.");
  return [webinarA, webinarB] as const;
}

/** Serialize mutations for one owner; public allocation additionally locks the experiment row. */
async function lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
  const found = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "user" WHERE id = ${ownerId} FOR UPDATE`;
  if (!found.length) throw new AbTestError("unauthorized", 401);
}
async function lockOwned(tx: Prisma.TransactionClient, ownerId: string, id: string) {
  const found = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ab_experiment" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
  if (!found.length) throw new AbTestError("not_found", 404, "Teste não encontrado.");
  const experiment = await tx.abExperiment.findFirst({ where: { id, ownerId }, include: experimentInclude });
  if (!experiment) throw new AbTestError("not_found", 404, "Teste não encontrado.");
  return experiment;
}

export async function listExperiments(ownerId: string) {
  const [experiments, webinars] = await Promise.all([
    prisma.abExperiment.findMany({ where: { ownerId }, include: experimentInclude, orderBy: { createdAt: "desc" } }),
    prisma.webinar.findMany({ where: { ownerId }, select: webinarSelect, orderBy: { createdAt: "desc" } })
  ]);
  return { experiments: experiments.map(serializeExperiment), webinars };
}

export async function getExperiment(ownerId: string, id: string) {
  parsed(idSchema, id);
  const row = await prisma.abExperiment.findFirst({ where: { id, ownerId }, include: experimentInclude });
  if (!row) throw new AbTestError("not_found", 404, "Teste não encontrado.");
  return serializeExperiment(row);
}

export async function createExperiment(ownerId: string, input: unknown) {
  const value = parsed(createExperimentSchema, input), plan = planData(value);
  const now = new Date();
  let startedAt: Date | null = null, endsAt: Date | null = null;
  if (value.mode === "OBSERVATIONAL") {
    if (!value.from || !value.to) throw new AbTestError("invalid_range", 400, "Escolha o período da comparação.");
    startedAt = new Date(value.from); endsAt = new Date(value.to);
    if (startedAt >= endsAt || endsAt.getTime() - startedAt.getTime() > 366 * 86_400_000 || startedAt > now || endsAt.getTime() > now.getTime() + 86_400_000) {
      throw new AbTestError("invalid_range", 400, "Escolha um período histórico válido de até 366 dias.");
    }
  } else if (value.from || value.to) {
    throw new AbTestError("invalid_range", 400, "O período do experimento começa ao iniciar a coleta.");
  }
  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    await ownedWebinars(tx, ownerId, value.webinarAId, value.webinarBId);
    const row = await tx.abExperiment.create({ data: {
      ...plan, ownerId, mode: value.mode, status: value.mode === "OBSERVATIONAL" ? "COMPLETED" : "DRAFT",
      startedAt, endsAt, completedAt: value.mode === "OBSERVATIONAL" ? now : null
    }, include: experimentInclude });
    return serializeExperiment(row);
  });
}

async function validateActivation(tx: Prisma.TransactionClient, row: ExperimentRow, now: Date) {
  const [a, b] = await ownedWebinars(tx, row.ownerId, row.webinarAId, row.webinarBId);
  if (!row.hypothesis.trim()) throw new AbTestError("hypothesis_required", 409, "Descreva a mudança e a hipótese antes de iniciar o teste.");
  if ([a, b].some((w) => w.status !== "ACTIVE" || !w.slug)) throw new AbTestError("variants_not_active", 409, "Publique as duas versões e defina seus links antes de iniciar.");
  for (const [index, webinar] of [a, b].entries()) {
    const issues = abReadinessIssues(webinar, row.metric);
    if (issues.length) throw new AbTestError("variant_not_ready", 409, `Versão ${index === 0 ? "A" : "B"}: ${issues.join("; ")}.`);
  }
  const scheduleTest = row.testVariable === "SCHEDULE";
  if (!scheduleTest && a.mode !== b.mode) throw new AbTestError("incompatible_schedule", 409, "As versões precisam usar o mesmo modo de transmissão. Para comparar programação, selecione Horário e programação no planejamento.");
  if (!scheduleTest && a.mode === "UNICO") {
    const schedule = (w: typeof a) => JSON.stringify([w.startDate?.toISOString(), w.endDate?.toISOString(), w.timezone, w.recurring, [...w.recurringDays].sort()]);
    if (schedule(a) !== schedule(b)) throw new AbTestError("incompatible_schedule", 409, "Alinhe datas, horários e recorrência das duas versões.");
  }
  if ([a, b].some((w) => w.mode === "UNICO" && computePhase(withOccurrence(w, now), now) === "closed")) throw new AbTestError("variants_closed", 409, "As transmissões já foram encerradas; ajuste a programação antes de iniciar.");
  if (scheduleTest && [a, b].some(w => w.mode === "UNICO" && (!w.startDate || !w.endDate || w.startDate >= w.endDate))) throw new AbTestError("invalid_schedule", 409, "Defina o início e fim de cada versão com horário marcado.");
  const conflict = await tx.abExperiment.findFirst({ where: {
    ownerId: row.ownerId, id: { not: row.id }, mode: "RANDOMIZED", status: { in: ["RUNNING", "PAUSED"] },
    OR: [{ webinarAId: { in: [a.id, b.id] } }, { webinarBId: { in: [a.id, b.id] } }]
  }, select: { id: true } });
  if (conflict) throw new AbTestError("variant_in_use", 409, "Um destes webinars já participa de outro experimento em andamento. Encerre-o antes de iniciar este.");
  return { webinarAFingerprint: webinarFingerprint(a), webinarBFingerprint: webinarFingerprint(b),
    webinarASnapshot: snapshotAbConfiguration(a) as unknown as Prisma.InputJsonValue,
    webinarBSnapshot: snapshotAbConfiguration(b) as unknown as Prisma.InputJsonValue };
}

export async function updateExperiment(ownerId: string, id: string, input: unknown) {
  parsed(idSchema, id);
  const value = parsed(updateSchema, input);
  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const row = await lockOwned(tx, ownerId, id), now = new Date();
    let data: Prisma.AbExperimentUpdateInput;
    if (value.action === "conversion_window") {
      if (row.mode !== "OBSERVATIONAL") throw new AbTestError("plan_locked", 409, "A janela de um experimento randomizado faz parte do planejamento. Esta ação é exclusiva de comparações observacionais.");
      data = { conversionWindowHours: value.conversionWindowHours };
    } else if (value.action === "edit") {
      if (row.status !== "DRAFT" || row._count.assignments) throw new AbTestError("plan_locked", 409, "O plano fica fixo depois que a coleta começa. Crie outro teste para alterar a hipótese.");
      const plan = planData(value);
      await ownedWebinars(tx, ownerId, plan.webinarAId, plan.webinarBId);
      data = { name: plan.name, hypothesis: plan.hypothesis, metric: plan.metric, baselineRate: plan.baselineRate,
        testVariable: plan.testVariable, variantADescription: plan.variantADescription, variantBDescription: plan.variantBDescription,
        minimumDetectableLift: plan.minimumDetectableLift, sampleSizePerVariant: plan.sampleSizePerVariant,
        durationDays: plan.durationDays, conversionWindowHours: plan.conversionWindowHours,
        webinarA: { connect: { id: plan.webinarAId } }, webinarB: { connect: { id: plan.webinarBId } } };
    } else {
      if (row.mode !== "RANDOMIZED") throw new AbTestError("invalid_transition", 409, "Comparações históricas não distribuem tráfego.");
      if (value.action === "start") {
        if (row.status !== "DRAFT") throw new AbTestError("invalid_transition", 409, "Este teste já foi iniciado.");
        const fingerprints = await validateActivation(tx, row, now);
        data = { status: "RUNNING", startedAt: now, endsAt: new Date(now.getTime() + row.durationDays * 86_400_000), ...fingerprints };
      } else if (value.action === "pause") {
        if (row.status !== "RUNNING") throw new AbTestError("invalid_transition", 409, "Só é possível pausar um teste em andamento.");
        data = { status: "PAUSED", ...(!row.interruptedAt && row.endsAt && now < row.endsAt ? { interruptedAt: now } : {}) };
      } else if (value.action === "resume") {
        if (row.status !== "PAUSED" || !row.endsAt || row.endsAt <= now) throw new AbTestError("invalid_transition", 409, "A coleta só pode ser retomada antes do prazo original.");
        await validateActivation(tx, row, now);
        data = { status: "RUNNING" };
      } else {
        if (row.status !== "RUNNING" && row.status !== "PAUSED") throw new AbTestError("invalid_transition", 409, "Só é possível encerrar um teste iniciado.");
        data = { status: "COMPLETED", completedAt: now };
      }
    }
    return serializeExperiment(await tx.abExperiment.update({ where: { id }, data, include: experimentInclude }));
  });
}

export async function deleteExperiment(ownerId: string, id: string) {
  parsed(idSchema, id);
  await prisma.$transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const row = await lockOwned(tx, ownerId, id);
    if (row.status !== "DRAFT" || row._count.assignments) throw new AbTestError("plan_locked", 409, "Somente rascunhos sem participantes podem ser excluídos.");
    await tx.abExperiment.delete({ where: { id } });
  });
}
