import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: { user: { id: "owner", role: "admin" } } as { user: { id: string; role: string } } | null,
  lock: vi.fn(), find: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), webinars: vi.fn(), webinarUpdate: vi.fn(), transaction: vi.fn()
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => mocks.session } } }));
vi.mock("db", () => ({ prisma: {
  $transaction: mocks.transaction,
  abExperiment: { findFirst: mocks.find, findMany: mocks.findMany }, webinar: { findMany: mocks.webinars, update: mocks.webinarUpdate }
} }));
import { createExperiment, updateExperiment, deleteExperiment, getExperiment, requireAbAdmin } from "@/server/ab-tests/experiments";

const now = new Date("2026-11-11T12:00:00Z");
const a = { id: "a", ownerId: "owner", title: "A", name: "A", status: "ACTIVE", slug: "version-a", mode: "JIT", recurringDays: [], video: { status: "READY", hlsUrl: "https://video.test/a.m3u8", durationSec: 3600 }, pitchAtSec: 1800, offerDisabled: false, offerLink: "https://checkout.test/a", offerShowAtSec: 1800, offerHideAtSec: null };
const b = { ...a, id: "b", title: "B", name: "B", slug: "version-b" };
const plan = { name: "Oferta alternativa", hypothesis: "Nova oferta aumenta compras", webinarAId: "a", webinarBId: "b", metric: "PURCHASE", baselineRate: 0.05, minimumDetectableLift: 0.2, durationDays: 14, conversionWindowHours: 72 };
const recurringA = { ...a, mode: "UNICO", recurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6], timezone: "America/Sao_Paulo",
  startDate: new Date("2026-11-11T18:00:00Z"), endDate: new Date("2026-11-11T20:10:00Z") };
const recurringB = { ...recurringA, ...b, mode: "UNICO", recurringDays: recurringA.recurringDays,
  startDate: new Date("2026-10-30T23:00:00Z"), endDate: new Date("2026-10-31T01:10:00Z") };
function record(extra: Record<string, unknown> = {}) {
  return { id: "exp", ownerId: "owner", ...plan, mode: "RANDOMIZED", status: "DRAFT", sampleSizePerVariant: 8158,
    startedAt: null, endsAt: null, completedAt: null, createdAt: now, updatedAt: now, webinarA: a, webinarB: b,
    _count: { assignments: 0 }, ...extra };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks();
  mocks.session = { user: { id: "owner", role: "admin" } };
  mocks.lock.mockResolvedValue([{ id: "owner" }]); mocks.find.mockResolvedValue(record()); mocks.webinars.mockResolvedValue([a, b]);
  mocks.create.mockImplementation(async ({ data }) => record(data));
  mocks.update.mockImplementation(async ({ data }) => record(data)); mocks.remove.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn) => fn({ $queryRaw: mocks.lock,
    abExperiment: { findFirst: mocks.find, create: mocks.create, update: mocks.update, delete: mocks.remove }, webinar: { findMany: mocks.webinars, update: mocks.webinarUpdate }
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("experiment management", () => {
  it("freezes a server-calculated sample target and owner for new drafts", async () => {
    const result = await createExperiment("owner", { ...plan, mode: "RANDOMIZED" });
    expect(result.sampleSizePerVariant).toBe(8158); expect(result.status).toBe("DRAFT");
    expect(result).not.toHaveProperty("ownerId");
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ ownerId: "owner", sampleSizePerVariant: 8158 });
    expect(mocks.webinars).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner", id: { in: ["a", "b"] } } }));
  });
  it("rejects owner/sample injection, duplicate variants and invalid sample plans", async () => {
    for (const extra of [{ ownerId: "victim" }, { sampleSizePerVariant: 1 }, { webinarBId: "a" }, { baselineRate: 0.9, minimumDetectableLift: 0.2 }, { durationDays: 2 }]) {
      await expect(createExperiment("owner", { ...plan, mode: "RANDOMIZED", ...extra })).rejects.toMatchObject({ status: 400 });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects foreign webinar ids", async () => {
    mocks.webinars.mockResolvedValue([a]);
    await expect(createExperiment("owner", { ...plan, mode: "RANDOMIZED" })).rejects.toMatchObject({ code: "webinar_not_found" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires an explicit valid historical interval and creates observational comparisons completed", async () => {
    await expect(createExperiment("owner", { ...plan, mode: "OBSERVATIONAL" })).rejects.toMatchObject({ code: "invalid_range" });
    const result = await createExperiment("owner", { ...plan, mode: "OBSERVATIONAL", from: "2026-11-01T03:00:00Z", to: "2026-11-08T03:00:00Z" });
    expect(result.status).toBe("COMPLETED"); expect(result.publicPath).toBeNull(); expect(result.startedAt).toBe("2026-11-01T03:00:00.000Z");
    expect(result.observationUnit).toBe("LEAD");
    await expect(createExperiment("owner", { ...plan, mode: "OBSERVATIONAL", from: "2026-11-11T03:00:00Z", to: "2026-12-11T02:59:59.999Z" }))
      .rejects.toMatchObject({ code: "invalid_range" });
  });
  it("creates a 30-day recurring comparison from the first webinar day without writing either webinar", async () => {
    mocks.webinars.mockResolvedValue([recurringA, recurringB]);
    const result = await createExperiment("owner", { ...plan, mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION",
      from: "2026-11-11T18:00:00Z", durationDays: 30, conversionWindowHours: 24 });

    expect(result).toMatchObject({ status: "RUNNING", observationUnit: "DAILY_SESSION", durationDays: 30, conversionWindowHours: 24,
      startedAt: "2026-11-11T03:00:00.000Z", endsAt: "2026-12-11T02:59:59.999Z", completedAt: null, publicPath: null });
    expect(result.configuration).toMatchObject({ frozen: true, A: { startAt: "2026-11-11T18:00:00.000Z" }, B: { startAt: "2026-10-30T23:00:00.000Z" } });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ observationUnit: "DAILY_SESSION", webinarAFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      webinarBFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(mocks.webinarUpdate).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("defaults recurring comparisons to 30 days and 24 hours and permits a future start", async () => {
    mocks.webinars.mockResolvedValue([recurringA, recurringB]);
    const { durationDays: _duration, conversionWindowHours: _window, ...minimalPlan } = plan;
    const result = await createExperiment("owner", { ...minimalPlan, mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", from: "2026-11-15T03:00:00Z" });
    expect(result).toMatchObject({ status: "RUNNING", durationDays: 30, conversionWindowHours: 24,
      startedAt: "2026-11-15T03:00:00.000Z", endsAt: "2026-12-15T02:59:59.999Z" });
  });
  it("keeps already-ended daily comparisons completed and derives elapsed status on reads without updating", async () => {
    mocks.webinars.mockResolvedValue([recurringA, recurringB]);
    const result = await createExperiment("owner", { ...plan, mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", from: "2026-10-01T03:00:00Z", durationDays: 30 });
    expect(result).toMatchObject({ status: "COMPLETED", completedAt: "2026-10-31T02:59:59.999Z" });
    mocks.find.mockResolvedValue(record({ mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", status: "RUNNING", endsAt: new Date("2026-11-11T02:59:59.999Z") }));
    expect((await getExperiment("owner", "exp")).status).toBe("COMPLETED");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects recurring units for randomization, missing starts and conflicting end dates", async () => {
    await expect(createExperiment("owner", { ...plan, mode: "RANDOMIZED", observationUnit: "DAILY_SESSION" }))
      .rejects.toMatchObject({ code: "invalid_observation_unit" });
    for (const range of [{}, { from: "2026-11-11T03:00:00Z", to: "2026-12-11T02:59:59.999Z" }]) {
      await expect(createExperiment("owner", { ...plan, mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", ...range }))
        .rejects.toMatchObject({ code: "invalid_range" });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires published recurrent scheduled webinars only for the new daily comparison", async () => {
    const input = { ...plan, mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", from: "2026-11-11T03:00:00Z" };
    for (const broken of [{ ...recurringB, mode: "JIT" }, { ...recurringB, recurring: false }, { ...recurringB, recurringDays: [] },
      { ...recurringB, startDate: null }, { ...recurringB, endDate: recurringB.startDate }]) {
      mocks.webinars.mockResolvedValue([recurringA, broken]);
      await expect(createExperiment("owner", input)).rejects.toMatchObject({ code: "invalid_recurring_schedule" });
    }
    mocks.webinars.mockResolvedValue([recurringA, { ...recurringB, status: "ARCHIVED" }]);
    await expect(createExperiment("owner", input)).rejects.toMatchObject({ code: "variants_not_active" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.webinarUpdate).not.toHaveBeenCalled();
  });
  it("ends daily collection early while preserving conversion time and rejecting pause/resume", async () => {
    const original = record({ mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", status: "RUNNING", conversionWindowHours: 24,
      startedAt: new Date("2026-11-11T03:00:00Z"), endsAt: new Date("2026-12-11T02:59:59.999Z") });
    mocks.find.mockResolvedValue(original);
    mocks.update.mockImplementation(async ({ data }) => ({ ...original, ...data }));
    for (const action of ["start", "pause", "resume"]) await expect(updateExperiment("owner", "exp", { action })).rejects.toMatchObject({ code: "invalid_transition" });
    const result = await updateExperiment("owner", "exp", { action: "complete" });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "COMPLETED", endsAt: now, completedAt: now } }));
    expect(result).toMatchObject({ conversionWindowHours: 24, endsAt: now.toISOString(), status: "COMPLETED" });
    expect(mocks.webinarUpdate).not.toHaveBeenCalled();
    mocks.find.mockResolvedValue({ ...original, startedAt: new Date("2026-11-12T03:00:00Z") });
    await expect(updateExperiment("owner", "exp", { action: "complete" })).rejects.toMatchObject({ code: "invalid_transition" });
    mocks.find.mockResolvedValue({ ...original, endsAt: new Date("2026-11-10T03:00:00Z") });
    await expect(updateExperiment("owner", "exp", { action: "complete" })).rejects.toMatchObject({ code: "invalid_transition" });
  });
  it.each([24, 72, 168])("changes only the conversion window of an observational comparison to %sh", async (conversionWindowHours) => {
    const original = record({ mode: "OBSERVATIONAL", status: "COMPLETED", startedAt: new Date("2026-11-01T03:00:00Z"),
      endsAt: new Date("2026-11-08T03:00:00Z"), completedAt: now });
    mocks.find.mockResolvedValue(original);
    mocks.update.mockImplementation(async ({ data }) => ({ ...original, ...data }));

    const result = await updateExperiment("owner", "exp", { action: "conversion_window", conversionWindowHours });

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "exp" }, data: { conversionWindowHours } }));
    expect(result).toMatchObject({ conversionWindowHours, mode: "OBSERVATIONAL", status: "COMPLETED", metric: "PURCHASE",
      webinarAId: "a", webinarBId: "b", startedAt: "2026-11-01T03:00:00.000Z", endsAt: "2026-11-08T03:00:00.000Z",
      completedAt: now.toISOString(), hypothesis: plan.hypothesis });
    expect(mocks.lock.mock.calls[1].slice(1)).toEqual(["exp", "owner"]);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "exp", ownerId: "owner" } }));
    expect(mocks.webinars).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "RUNNING", "PAUSED", "COMPLETED"])("rejects the observational window action for a %s randomized experiment", async (status) => {
    mocks.find.mockResolvedValue(record({ status }));
    await expect(updateExperiment("owner", "exp", { action: "conversion_window", conversionWindowHours: 24 }))
      .rejects.toMatchObject({ code: "plan_locked", status: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects invalid window lengths and unrelated fields before opening a mutation transaction", async () => {
    for (const input of [
      { action: "conversion_window" }, { action: "conversion_window", conversionWindowHours: "24" },
      ...[0, 12, 48, 169, NaN].map(conversionWindowHours => ({ action: "conversion_window", conversionWindowHours })),
      { action: "conversion_window", conversionWindowHours: 24, ownerId: "victim" },
      { action: "conversion_window", conversionWindowHours: 24, status: "RUNNING" },
      { action: "conversion_window", conversionWindowHours: 24, webinarAId: "foreign" }
    ]) await expect(updateExperiment("owner", "exp", input)).rejects.toMatchObject({ code: "invalid_input", status: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not change an absent or foreign comparison's window", async () => {
    mocks.lock.mockResolvedValueOnce([{ id: "owner" }]).mockResolvedValueOnce([]);
    await expect(updateExperiment("owner", "foreign", { action: "conversion_window", conversionWindowHours: 24 }))
      .rejects.toMatchObject({ code: "not_found", status: 404 });
    expect(mocks.lock.mock.calls[1].slice(1)).toEqual(["foreign", "owner"]);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("starts only after ownership/readiness validation and stores immutable configuration hashes", async () => {
    mocks.find.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);
    const result = await updateExperiment("owner", "exp", { action: "start" });
    expect(result.startedAt).toBe(now.toISOString()); expect(result.endsAt).toBe("2026-11-25T12:00:00.000Z");
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "RUNNING", webinarAFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), webinarBFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(mocks.lock).toHaveBeenCalledTimes(2);
  });
  it("rejects overlapping active experiments and incompatible webinar modes", async () => {
    mocks.find.mockResolvedValueOnce(record()).mockResolvedValueOnce({ id: "other-test" });
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "variant_in_use" });
    mocks.find.mockResolvedValue(record()); mocks.webinars.mockResolvedValue([a, { ...b, mode: "UNICO" }]);
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "incompatible_schedule" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("allows different schedules only for an explicitly planned schedule experiment and freezes both conditions", async () => {
    const scheduledA = { ...a, mode: "UNICO", startDate: new Date("2026-11-11T22:00:00Z"), endDate: new Date("2026-11-11T23:00:00Z"), timezone: "America/Sao_Paulo", recurring: false };
    const scheduledB = { ...b, mode: "UNICO", startDate: new Date("2026-11-12T00:00:00Z"), endDate: new Date("2026-11-12T01:00:00Z"), timezone: "America/Sao_Paulo", recurring: false };
    mocks.webinars.mockResolvedValue([scheduledA, scheduledB]);
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "incompatible_schedule" });
    mocks.find.mockResolvedValueOnce(record({ testVariable: "SCHEDULE", variantADescription: "19h", variantBDescription: "21h" })).mockResolvedValueOnce(null);
    await updateExperiment("owner", "exp", { action: "start" });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      webinarASnapshot: { version: 1, startAt: "2026-11-11T22:00:00.000Z" },
      webinarBSnapshot: { version: 1, startAt: "2026-11-12T00:00:00.000Z" }
    });
  });
  it("blocks collection when the hypothesis or either variant cannot measure the selected metric", async () => {
    mocks.find.mockResolvedValue(record({ hypothesis: "  " }));
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "hypothesis_required" });
    mocks.find.mockResolvedValue(record());
    mocks.webinars.mockResolvedValue([a, { ...b, video: { ...b.video, status: "PROCESSING" } }]);
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "variant_not_ready", message: expect.stringContaining("Versão B") });
    mocks.find.mockResolvedValue(record({ metric: "PITCH_REACHED" }));
    mocks.webinars.mockResolvedValue([{ ...a, pitchAtSec: null }, b]);
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "variant_not_ready", message: expect.stringContaining("pitch") });
    mocks.find.mockResolvedValue(record({ metric: "OFFER_CLICK" }));
    mocks.webinars.mockResolvedValue([a, { ...b, offerDisabled: true }]);
    await expect(updateExperiment("owner", "exp", { action: "start" })).rejects.toMatchObject({ code: "variant_not_ready", message: expect.stringContaining("ative a oferta") });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not rewrite plans or delete participants after starting", async () => {
    mocks.find.mockResolvedValue(record({ status: "RUNNING", _count: { assignments: 1 } }));
    await expect(updateExperiment("owner", "exp", { action: "edit", ...plan })).rejects.toMatchObject({ code: "plan_locked" });
    await expect(deleteExperiment("owner", "exp")).rejects.toMatchObject({ code: "plan_locked" });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("records early stopping without changing the original horizon", async () => {
    mocks.find.mockResolvedValue(record({ status: "RUNNING", endsAt: new Date("2026-11-25T12:00:00Z") }));
    await updateExperiment("owner", "exp", { action: "complete" });
    expect(mocks.update.mock.calls[0][0].data).toEqual({ status: "COMPLETED", completedAt: now });
  });
  it("records the first pause before the horizon and never clears its interruption on resume/completion", async () => {
    const endsAt = new Date("2026-11-25T12:00:00Z");
    mocks.find.mockResolvedValue(record({ status: "RUNNING", endsAt }));
    const paused = await updateExperiment("owner", "exp", { action: "pause" });
    expect(mocks.update.mock.calls[0][0].data).toEqual({ status: "PAUSED", interruptedAt: now });
    expect(paused.interruptedAt).toBe(now.toISOString());
    const firstPause = new Date("2026-11-10T12:00:00Z");
    mocks.find.mockResolvedValue(record({ status: "RUNNING", endsAt, interruptedAt: firstPause }));
    await updateExperiment("owner", "exp", { action: "pause" });
    expect(mocks.update.mock.calls[1][0].data).toEqual({ status: "PAUSED" });
    mocks.find.mockResolvedValueOnce(record({ status: "PAUSED", endsAt, interruptedAt: firstPause })).mockResolvedValueOnce(null);
    await updateExperiment("owner", "exp", { action: "resume" });
    expect(mocks.update.mock.calls[2][0].data).toEqual({ status: "RUNNING" });
    mocks.find.mockResolvedValue(record({ status: "RUNNING", endsAt, interruptedAt: firstPause }));
    await updateExperiment("owner", "exp", { action: "complete" });
    expect(mocks.update.mock.calls[3][0].data).toEqual({ status: "COMPLETED", completedAt: now });
  });
  it("does not invalidate an already-ended collection by pausing after its horizon", async () => {
    mocks.find.mockResolvedValue(record({ status: "RUNNING", endsAt: new Date("2026-11-10T12:00:00Z") }));
    await updateExperiment("owner", "exp", { action: "pause" });
    expect(mocks.update.mock.calls[0][0].data).toEqual({ status: "PAUSED" });
  });
  it("cannot resume after the prespecified horizon", async () => {
    mocks.find.mockResolvedValue(record({ status: "PAUSED", endsAt: new Date("2026-11-10T12:00:00Z") }));
    await expect(updateExperiment("owner", "exp", { action: "resume" })).rejects.toMatchObject({ code: "invalid_transition" });
  });
  it("scopes individual reads and locks to the owner", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(getExperiment("owner", "foreign")).rejects.toMatchObject({ status: 404 });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign", ownerId: "owner" } }));
    mocks.lock.mockResolvedValueOnce([{ id: "owner" }]).mockResolvedValueOnce([]);
    await expect(deleteExperiment("owner", "foreign")).rejects.toMatchObject({ status: 404 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe("experiment API authorization", () => {
  const request = (origin?: string) => new Request("https://app.test/api/ab-tests", { headers: origin ? { origin } : {} });
  it("requires an admin and a same-origin mutation", async () => {
    mocks.session = null;
    await expect(requireAbAdmin(request())).rejects.toMatchObject({ status: 401 });
    for (const role of ["attendant", "disabled", "user"]) {
      mocks.session = { user: { id: "owner", role } };
      await expect(requireAbAdmin(request())).rejects.toMatchObject({ status: 403 });
    }
    mocks.session = { user: { id: "owner", role: "admin" } };
    for (const origin of [undefined, "https://evil.test", "https://user:pass@app.test", "null", "http://app.test"]) {
      await expect(requireAbAdmin(request(origin), true)).rejects.toMatchObject({ code: "invalid_origin" });
    }
    expect(await requireAbAdmin(request("https://app.test"), true)).toBe("owner");
    vi.stubEnv("BETTER_AUTH_URL", "https://public.test");
    expect(await requireAbAdmin(request("https://public.test"), true)).toBe("owner");
  });
});
