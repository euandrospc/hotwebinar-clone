import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import { createDashboardDemo } from "@/lib/dashboard-demo";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), webinars: vi.fn(), overview: vi.fn(), insights: vi.fn(),
  picker: vi.fn((_props: Record<string, unknown>) => null), range: vi.fn((_props: Record<string, unknown>) => null), realtime: vi.fn((_props: Record<string, unknown>) => null),
  support: vi.fn((_props: Record<string, unknown>) => null), intelligence: vi.fn((_props: Record<string, unknown>) => null)
}));

vi.mock("db", () => ({ prisma: { webinar: { findMany: mocks.webinars } } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: () => { throw new Error("NEXT_REDIRECT"); }
}));
vi.mock("@/server/dashboard/overview", () => ({ getDashboardOverview: mocks.overview }));
vi.mock("@/server/dashboard/insights", () => ({ getDashboardInsights: mocks.insights }));
vi.mock("@/server/admin-brand", () => ({ getAdminBrandName: vi.fn() }));
vi.mock("@/components/dashboard/dashboard-webinar-picker", () => ({ DashboardWebinarPicker: mocks.picker }));
vi.mock("@/components/dashboard/dashboard-range-picker", () => ({ DashboardRangePicker: mocks.range }));
vi.mock("@/components/dashboard/dashboard-realtime-preview", () => ({ DashboardRealtimePreview: mocks.realtime }));
vi.mock("@/components/dashboard/dashboard-support-overview", () => ({ DashboardSupportOverview: mocks.support }));
vi.mock("@/components/dashboard/dashboard-chat-intelligence", () => ({ DashboardChatIntelligence: mocks.intelligence }));
vi.mock("@/components/dashboard/dashboard-summary", () => ({ DashboardSummary: () => null }));
vi.mock("@/components/dashboard/dashboard-funnel-overview", () => ({ DashboardFunnelOverview: () => null }));
vi.mock("@/components/dashboard/dashboard-watch-chart", () => ({ DashboardWatchChart: () => null }));
vi.mock("@/components/dashboard/dashboard-audience-map", () => ({ DashboardAudienceMap: () => null }));
vi.mock("@/components/dashboard/dashboard-motion", () => ({ DashboardMotion: ({ children }: { children: ReactNode }) => children }));

const user = { id: "owner-1", role: "OWNER" };
const webinars = [
  { id: "draft", title: "Rascunho", name: "Draft", status: "DRAFT" },
  { id: "active", title: "Webinar ativo", name: "Active", status: "ACTIVE" },
  { id: "other", title: "Outro webinar", name: "Other", status: "ACTIVE" }
];
const dates = { from: "2026-11-01T10:00", to: "2026-11-16T18:00" };
type SearchParams = Awaited<Parameters<typeof DashboardPage>[0]["searchParams"]>;
const loadPage = (searchParams: SearchParams = {}) => DashboardPage({ searchParams: Promise.resolve(searchParams) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  mocks.session.mockResolvedValue({ user });
  mocks.webinars.mockResolvedValue(webinars);
  const data = createDashboardDemo(new Date("2026-11-01T03:00:00Z"), new Date("2026-11-16T21:00:59.999Z"));
  mocks.overview.mockResolvedValue(data.overview);
  mocks.insights.mockResolvedValue(data.insights);
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("Dashboard all-webinar scope", () => {
  it("uses the authenticated scope and all webinars for metrics, live audience and support", async () => {
    render(await loadPage({ ...dates, webinarId: "all" }));

    expect(mocks.webinars).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: user.id } }));
    const expectedArguments = [user, new Date("2026-11-01T13:00:00Z"), new Date("2026-11-16T21:00:59.999Z"), undefined];
    expect(mocks.overview).toHaveBeenCalledWith(...expectedArguments);
    expect(mocks.insights).toHaveBeenCalledWith(...expectedArguments);
    expect(mocks.picker.mock.calls[0][0]).toMatchObject({ selectedId: "all" });
    expect(mocks.range.mock.calls[0][0]).toMatchObject({ queryParams: { webinarId: "all" } });
    expect(mocks.realtime.mock.calls[0][0]).toMatchObject({ webinarId: undefined });
    expect(mocks.support.mock.calls[0][0]).toMatchObject({ webinarId: undefined });
    expect(mocks.intelligence.mock.calls[0][0]).toMatchObject({ webinarId: "all" });
  });

  it("keeps the existing active-webinar default when there is no explicit selection", async () => {
    render(await loadPage(dates));
    expect(mocks.overview.mock.calls[0][3]).toBe("active");
    expect(mocks.insights.mock.calls[0][3]).toBe("active");
    expect(mocks.picker.mock.calls[0][0]).toMatchObject({ selectedId: "active" });
  });

  it("returns every metric and date-filter scope to the individually selected webinar", async () => {
    render(await loadPage({ ...dates, webinarId: "other" }));
    expect(mocks.overview.mock.calls[0][3]).toBe("other");
    expect(mocks.insights.mock.calls[0][3]).toBe("other");
    expect(mocks.range.mock.calls[0][0]).toMatchObject({ queryParams: { webinarId: "other" } });
    expect(mocks.realtime.mock.calls[0][0]).toMatchObject({ webinarId: "other" });
    expect(mocks.support.mock.calls[0][0]).toMatchObject({ webinarId: "other" });
    expect(mocks.intelligence.mock.calls[0][0]).toMatchObject({ webinarId: "other" });
  });

  it("rejects an unknown or unauthorized webinar instead of silently broadening the scope", async () => {
    await expect(loadPage({ webinarId: "another-owner-webinar" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(mocks.insights).not.toHaveBeenCalled();
  });

  it("keeps all-mode demo data isolated from operational queries", async () => {
    vi.stubEnv("NODE_ENV", "development");
    render(await loadPage({ ...dates, webinarId: "all" }));
    expect(mocks.webinars).not.toHaveBeenCalled();
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(mocks.insights).not.toHaveBeenCalled();
    expect(mocks.realtime.mock.calls[0][0]).toMatchObject({ webinarId: undefined, demoOnline: expect.any(Number) });
    expect(mocks.intelligence.mock.calls[0][0]).toMatchObject({ webinarId: "all", demoReport: expect.any(Object) });
    expect(mocks.range.mock.calls[0][0]).toMatchObject({ queryParams: { webinarId: "all", demo: "1" } });
  });

  it("allows an empty account to request Todos without treating it as an unknown webinar", async () => {
    mocks.webinars.mockResolvedValue([]);
    await loadPage({ webinarId: "all" });
    expect(mocks.overview.mock.calls[0][3]).toBeUndefined();
    expect(mocks.insights.mock.calls[0][3]).toBeUndefined();
  });
});
