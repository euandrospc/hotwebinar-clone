import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  lock: vi.fn(), experiment: vi.fn(), assignment: vi.fn(), create: vi.fn(), update: vi.fn(), lead: vi.fn(), transaction: vi.fn(), randomInt: vi.fn()
}));
vi.mock("@/server/ab-tests/experiments", () => ({ AbTestError: class extends Error { constructor(public code: string, public status: number, message?: string) { super(message ?? code); } } }));
vi.mock("node:crypto", async (original) => ({ ...await original<typeof import("node:crypto")>(), randomInt: mocks.randomInt }));
vi.mock("db", () => ({ prisma: {
  $transaction: mocks.transaction,
  abAssignment: { findUnique: mocks.assignment, findFirst: mocks.assignment, updateMany: mocks.update }, lead: { findFirst: mocks.lead }
} }));
import { allocateAbVisitor, bindAbAssignmentToLead, resolveBoundAbAssignment } from "@/server/ab-tests/assignment";
import { signAbAssignment } from "@/lib/ab-test-cookie";

const now = new Date("2026-11-11T12:00:00Z");
const a = { id: "a", ownerId: "owner", status: "ACTIVE", slug: "version-a", mode: "JIT", recurring: false, recurringDays: [] };
const b = { ...a, id: "b", slug: "version-b" };
function experiment(extra: Record<string, unknown> = {}) {
  return { id: "exp", ownerId: "owner", mode: "RANDOMIZED", status: "RUNNING", webinarAId: "a", webinarBId: "b", webinarA: a, webinarB: b,
    conversionWindowHours: 72, startedAt: new Date("2026-11-01T12:00:00Z"), endsAt: new Date("2026-11-15T12:00:00Z"), ...extra };
}
function assignment(extra: Record<string, unknown> = {}) {
  return { id: "asgn", experimentId: "exp", visitorId: "visitor", variant: "B", leadId: null, createdAt: now, experiment: experiment(), ...extra };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); vi.stubEnv("LEAD_SESSION_SECRET", "test-secret-at-least-16-characters");
  mocks.lock.mockResolvedValue([{ id: "exp" }]); mocks.experiment.mockResolvedValue(experiment()); mocks.assignment.mockResolvedValue(null);
  mocks.randomInt.mockReturnValue(1); mocks.create.mockImplementation(async ({ data }) => assignment(data)); mocks.lead.mockResolvedValue({ id: "lead" }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) => fn({ $queryRaw: mocks.lock, abExperiment: { findUnique: mocks.experiment }, abAssignment: { findUnique: mocks.assignment, create: mocks.create } }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("public experiment allocation", () => {
  it("persists assignment before returning destination and ignores requested variant", async () => {
    const result = await allocateAbVisitor("exp", "visitor", new URLSearchParams("variant=A&utm_source=meta&utm_campaign=launch"), "Mozilla/5.0 (iPhone)");
    expect(result).toEqual({ assignmentId: "asgn", webinarId: "b", slug: "version-b", variant: "B" });
    expect(mocks.randomInt).toHaveBeenCalledWith(2);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ visitorId: "visitor", experimentId: "exp", variant: "B", utmSource: "meta", utmCampaign: "launch", device: "mobile" }) });
    expect(mocks.lock).toHaveBeenCalledOnce();
  });
  it.each(["RUNNING", "PAUSED", "COMPLETED"])("keeps the same variant and original acquisition snapshot when %s", async (status) => {
    mocks.experiment.mockResolvedValue(experiment({ status })); mocks.assignment.mockResolvedValue(assignment({ variant: "A", utmSource: "original" }));
    const result = await allocateAbVisitor("exp", "visitor", new URLSearchParams("variant=B&utm_source=new"), "mobile");
    expect(result.variant).toBe("A"); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.randomInt).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "PAUSED", "COMPLETED"])("does not enroll new visitors when %s", async (status) => {
    mocks.experiment.mockResolvedValue(experiment({ status }));
    await expect(allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).rejects.toMatchObject({ code: "allocation_closed" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("stops new enrollment at the exact planned horizon", async () => {
    mocks.experiment.mockResolvedValue(experiment({ endsAt: now }));
    await expect(allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).rejects.toMatchObject({ code: "allocation_closed" });
    mocks.assignment.mockResolvedValue(assignment());
    expect((await allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).variant).toBe("B");
  });
  it("does not shift traffic to the healthy variant if either variant is unavailable or closed", async () => {
    for (const webinarA of [{ ...a, status: "ARCHIVED" }, { ...a, mode: "UNICO", startDate: new Date("2026-11-01T10:00:00Z"), endDate: new Date("2026-11-01T12:00:00Z") }]) {
      mocks.experiment.mockResolvedValue(experiment({ webinarA }));
      await expect(allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).rejects.toMatchObject({ code: "variant_unavailable" });
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not expose observational or missing experiments", async () => {
    mocks.experiment.mockResolvedValue(experiment({ mode: "OBSERVATIONAL" }));
    await expect(allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).rejects.toMatchObject({ status: 404 });
    mocks.lock.mockResolvedValue([]);
    await expect(allocateAbVisitor("exp", "visitor", new URLSearchParams(), null)).rejects.toMatchObject({ status: 404 });
  });
});

describe("assignment attribution binding", () => {
  it("binds only the assigned webinar and uses compare-and-swap for concurrent opt-ins", async () => {
    mocks.assignment.mockResolvedValue(assignment());
    await bindAbAssignmentToLead("a", "lead", signAbAssignment("asgn"));
    expect(mocks.update).not.toHaveBeenCalled();
    await bindAbAssignmentToLead("b", "lead", signAbAssignment("asgn"));
    expect(mocks.lead).toHaveBeenCalledWith({ where: { id: "lead", webinarId: "b" }, select: { id: true } });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "asgn", leadId: null }, data: { leadId: "lead" } });
  });
  it("never rebinds an assignment to another identity or after its outcome window", async () => {
    mocks.assignment.mockResolvedValue(assignment({ leadId: "first" }));
    await bindAbAssignmentToLead("b", "second", signAbAssignment("asgn"));
    mocks.assignment.mockResolvedValue(assignment({ createdAt: new Date("2026-11-01T12:00:00Z") }));
    await bindAbAssignmentToLead("b", "second", signAbAssignment("asgn"));
    await bindAbAssignmentToLead("b", "second", "forged.token");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("resolves checkout attribution only for a signed token/current lead/correct webinar within window", async () => {
    mocks.assignment.mockResolvedValue(assignment({ leadId: "lead" }));
    const token = signAbAssignment("asgn");
    expect(await resolveBoundAbAssignment("b", "lead", token)).toMatchObject({ id: "asgn" });
    expect(mocks.assignment).toHaveBeenCalledWith({ where: { id: "asgn", leadId: "lead" }, include: { experiment: true } });
    expect(await resolveBoundAbAssignment("a", "lead", token)).toBeNull();
    expect(await resolveBoundAbAssignment("b", "lead", "forged.token")).toBeNull();
    expect(await resolveBoundAbAssignment("b", "lead", token, new Date("2026-11-15T12:00:00Z"))).toBeNull();
  });
});
