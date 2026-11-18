import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeDashboardV5 } from "@/components/webinar/realtime-dashboard-v5";
import type { RealtimeKpis } from "@/lib/realtime-kpis-v5";
import type { RealtimeAccessTimeV5Data } from "@/lib/realtime-access-time-v5";
import type { RealtimeDevicesV5Data } from "@/lib/realtime-devices-v5";
import type { RealtimeRegionsV5Data } from "@/lib/realtime-regions-v5";
import type { RealtimeAttendantsV5Data } from "@/lib/realtime-attendants-v5";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/webinar/realtime-kpi-cards-v5", () => ({
  RealtimeKpiCardsV5: ({ kpis }: { kpis: RealtimeKpis }) => (
    <dl>
      <dt>users live</dt><dd data-testid="live">{kpis.live.value ?? "—"}</dd>
      <dt>Audience</dt><dd data-testid="audience" data-points={JSON.stringify(kpis.audience.points)}>{kpis.audience.value ?? "—"}</dd>
      <dt>Revenue</dt><dd data-testid="revenue">{kpis.revenue.value ?? "—"}</dd>
    </dl>
  ),
}));

vi.mock("@/components/webinar/realtime-funnel-v5", () => ({
  RealtimeFunnelV5: ({ stages }: { stages?: Array<{ count: number }> }) => (
    <div data-testid="funnel">{stages?.map(stage => stage.count).join(",") ?? "Unavailable"}</div>
  ),
}));

vi.mock("@/components/webinar/realtime-users-map-v5", () => ({
  RealtimeUsersMapV5: ({ data }: { data: { available: boolean; totalOnline: number | null; brazilMapped: number | null } }) => (
    <div data-testid="users-map">{data.available ? `${data.brazilMapped}/${data.totalOnline}` : "Unavailable"}</div>
  ),
}));

vi.mock("@/components/webinar/realtime-session-v5", () => ({
  RealtimeSessionV5: ({ schedule }: { schedule?: WebinarRealtimeSnapshot["schedule"] }) => (
    <div data-testid="session-timeline">{schedule?.startDate ?? "Unavailable"}</div>
  ),
}));

vi.mock("@/components/webinar/realtime-devices-v5", () => ({
  RealtimeDevicesV5: ({ data }: { data: RealtimeDevicesV5Data }) => (
    <div data-testid="devices">{data.available ? `${data.total}:${data.items.map(item => item.count).join(",")}` : "Unavailable"}</div>
  ),
}));

vi.mock("@/components/webinar/realtime-audience-v5", () => ({
  RealtimeAudienceV5: ({ data, available, stale, timezone }: { data: RealtimeAccessTimeV5Data; available: boolean; stale?: boolean; timezone: string }) => (
    <div data-testid="audience-chart" data-stale={stale} data-timezone={timezone} data-range={JSON.stringify(data.range)}>
      {available ? JSON.stringify(data.points) : "Unavailable"}
    </div>
  ),
}));

vi.mock("@/components/webinar/realtime-regions-v5", () => ({
  RealtimeRegionsV5: ({ data }: { data: RealtimeRegionsV5Data }) => (
    <div data-testid="regions">{data.available ? `${data.total}:${data.items.map(item => item.count).join(",")}|${data.outsideBrazil}/${data.unmapped}` : "Unavailable"}</div>
  ),
}));

const fetchMock = vi.fn<typeof fetch>();
vi.mock("@/components/webinar/realtime-attendants-v5", () => ({
  RealtimeAttendantsV5: ({ data }: { data: RealtimeAttendantsV5Data }) => (
    <div data-testid="attendants">{data.available ? data.items.map(item => `${item.name}:${item.handledConversations}`).join(",") : "Unavailable"}</div>
  ),
}));

const initial: WebinarRealtimeSnapshot = {
  updatedAt: "2026-11-17T16:00:00.000Z",
  online: 24,
  devices: { desktop: 24, mobile: 0, tablet: 0, unknown: 0 },
  located: 0,
  unlocated: 24,
  locations: [],
  topCities: [],
  topCountries: [],
  funnel: [100, 75, 50, 12, 2].map((count, index) => ({ label: `Stage ${index}`, count, pct: count })),
  audience: { average: 16.5, peak: 30, peakAt: "2026-11-17T15:00:00.000Z", sampleCount: 10 },
  sales: {
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    today: { revenueCents: 123456, count: 2, excludedCount: 0, from: "2026-11-17T03:00:00.000Z", to: "2026-11-17T16:00:00.000Z" },
    yesterday: { revenueCents: 0, count: 0, excludedCount: 0, from: "2026-11-16T03:00:00.000Z", to: "2026-11-17T03:00:00.000Z" },
    changePct: null,
  },
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const nextSnapshot = (online: number): WebinarRealtimeSnapshot => ({
  ...initial,
  updatedAt: "2026-11-17T16:00:15.000Z",
  online,
  devices: { desktop: online, mobile: 0, tablet: 0, unknown: 0 },
});
const advance = async (milliseconds: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
};
const settle = async () => {
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(initial.updatedAt));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  fetchMock.mockReset().mockImplementation(async () => response(initial));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("realtime v5 refresh", () => {
  it("refreshes regions together with the map and keeps foreign or unmapped viewers outside the regional base", async () => {
    const next = { ...nextSnapshot(5), locations: [
      { id: "sp", name: null, city: null, region: "SP", country: "BR", lat: -23.55, lng: -46.63, count: 1 },
      { id: "sc", name: null, city: null, region: "SC", country: "BR", lat: -27.6, lng: -48.5, count: 1 },
      { id: "pt", name: null, city: null, region: "Lisbon", country: "PT", lat: 38.7, lng: -9.1, count: 1 },
    ] };
    fetchMock.mockResolvedValueOnce(response(next));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    expect(screen.getByTestId("regions")).toHaveTextContent("0:0,0,0,0,0|0/24");
    await advance(15_000);
    expect(screen.getByTestId("regions")).toHaveTextContent("2:1,1,0,0,0|1/2");
    expect(screen.getByTestId("users-map")).toHaveTextContent("2/5");
    expect(screen.getByTestId("live")).toHaveTextContent("5");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the daily observations without a shared session, preserving gaps and zero on refresh", async () => {
    const history = {
      from: "2026-11-17T03:00:00.000Z", to: initial.updatedAt,
      points: [{ at: "2026-11-17T15:59:30.000Z", online: 10 }, { at: initial.updatedAt, online: 12 }],
    };
    const first = { ...initial, audience: { ...initial.audience!, history } };
    const next = nextSnapshot(0);
    next.audience = { ...first.audience, history: {
      ...history, to: next.updatedAt, points: [...history.points, { at: next.updatedAt, online: 0 }],
    } };
    fetchMock.mockResolvedValueOnce(response(next));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={first} />);
    const chart = screen.getByTestId("audience-chart");
    expect(chart.textContent).toBe(screen.getByTestId("audience").getAttribute("data-points"));
    expect(JSON.parse(chart.textContent!).map((point: { value: number | null }) => point.value)).toEqual([10, null, 12]);
    expect(chart).toHaveAttribute("data-timezone", "America/Sao_Paulo");
    await advance(15_000);
    expect(chart.textContent).toBe(screen.getByTestId("audience").getAttribute("data-points"));
    expect(JSON.parse(chart.textContent!).map((point: { value: number | null }) => point.value)).toEqual([10, null, 12, 0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("scopes the large chart to the live session while keeping the miniature's daily history", async () => {
    const startDate = "2026-11-17T15:59:45.000Z";
    const endDate = "2026-11-17T17:00:00.000Z";
    const first: WebinarRealtimeSnapshot = { ...initial,
      schedule: { mode: "UNICO", startDate, endDate, videoSyncWithStart: true, pitchAtSec: null, offerShowAtSec: null, offerDisabled: true },
      audience: { ...initial.audience!, history: { from: "2026-11-17T03:00:00.000Z", to: initial.updatedAt, points: [
        { at: "2026-11-17T15:59:30.000Z", online: 10 }, { at: initial.updatedAt, online: 24 },
      ] } },
    };
    const next: WebinarRealtimeSnapshot = { ...first, updatedAt: "2026-11-17T16:00:15.000Z" };
    next.audience = { ...first.audience!, history: { ...first.audience!.history!, to: next.updatedAt,
      points: [...first.audience!.history!.points, { at: next.updatedAt, online: 12 }],
    } };
    fetchMock.mockResolvedValueOnce(response(next));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={first} />);
    const chart = screen.getByTestId("audience-chart");
    expect(JSON.parse(chart.textContent!).map((point: { value: number | null }) => point.value)).toEqual([24]);
    expect(chart).toHaveAttribute("data-range", JSON.stringify({ from: Date.parse(startDate), to: Date.parse(endDate) }));
    expect(JSON.parse(screen.getByTestId("audience").getAttribute("data-points")!).map((point: { value: number | null }) => point.value)).toEqual([10, null, 24]);
    await advance(15_000);
    expect(JSON.parse(chart.textContent!).map((point: { value: number | null }) => point.value)).toEqual([24, 12]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes devices from the same authorized snapshot as the live KPI", async () => {
    const next = { ...nextSnapshot(31), devices: { desktop: 12, mobile: 16, tablet: 1, unknown: 2 } };
    fetchMock.mockResolvedValueOnce(response(next));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    expect(screen.getByTestId("devices")).toHaveTextContent("24:24,0,0,0");
    await advance(15_000);
    expect(screen.getByTestId("devices")).toHaveTextContent("31:12,16,1,2");
    expect(screen.getByTestId("live")).toHaveTextContent("31");
  });

  it("refreshes the funnel from the same snapshot as the KPI values", async () => {
    const next = { ...nextSnapshot(31), funnel: initial.funnel!.map(stage => ({ ...stage, count: stage.count + 1 })) };
    fetchMock.mockResolvedValueOnce(response(next));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    expect(screen.getByTestId("funnel")).toHaveTextContent("100,75,50,12,2");
    await advance(15_000);
    expect(screen.getByTestId("funnel")).toHaveTextContent("101,76,51,13,3");
    expect(screen.getByTestId("live")).toHaveTextContent("31");
    expect(screen.getByTestId("users-map")).toHaveTextContent("0/31");
  });

  it("keeps demonstration data isolated from timers and foreground refreshes", async () => {
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} demo />);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.getByTestId("audience")).toHaveTextContent("16.5");
    expect(screen.getByTestId("revenue")).toHaveTextContent("1234.56");
    await advance(45_000);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts normal refreshes when switching from demonstration to real data", async () => {
    const { rerender } = render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} demo />);
    await advance(45_000);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(nextSnapshot(51)));
    rerender(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} demo={false} />);
    await advance(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("live")).toHaveTextContent("51");
  });

  it("aborts real requests when entering demonstration and ignores late real responses", async () => {
    let resolveRequest!: (result: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const { rerender } = render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    fireEvent.focus(window);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    const demonstration = nextSnapshot(81);
    rerender(<RealtimeDashboardV5 webinarId="one" initialSnapshot={demonstration} demo />);
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolveRequest(response(nextSnapshot(42))); });
    expect(screen.getByTestId("live")).toHaveTextContent("81");
    await advance(45_000);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the server snapshot immediately and refreshes after 15 seconds", async () => {
    fetchMock.mockResolvedValueOnce(response(nextSnapshot(0)));
    render(<RealtimeDashboardV5 webinarId="webinar one" initialSnapshot={initial} />);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.getByTestId("audience")).toHaveTextContent("16.5");
    expect(screen.getByTestId("revenue")).toHaveTextContent("1234.56");
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(14_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/webinars/webinar%20one/realtime-v5", {
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByTestId("live")).toHaveTextContent(/^0$/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not overlap requests when focus and visibility events arrive together", async () => {
    let resolveRequest!: (result: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    fireEvent.focus(window);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRequest(response(nextSnapshot(31))); });
    expect(screen.getByTestId("live")).toHaveTextContent("31");
    fireEvent.focus(window);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pauses requests while hidden and refreshes immediately when visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    await advance(45_000);
    fireEvent.focus(window);
    expect(fetchMock).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    fetchMock.mockResolvedValueOnce(response(nextSnapshot(40)));
    fireEvent(document, new Event("visibilitychange"));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("live")).toHaveTextContent("40");
  });

  it("retains the last successful values on failure and recovers on the next refresh", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(response(nextSnapshot(42)));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    await advance(15_000);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.getByTestId("revenue")).toHaveTextContent("1234.56");
    expect(screen.getByRole("status")).toHaveTextContent("Showing the last reading");
    expect(screen.getByTestId("audience-chart")).toHaveAttribute("data-stale", "true");
    await advance(15_000);
    expect(screen.getByTestId("live")).toHaveTextContent("42");
    expect(screen.getByTestId("audience-chart")).toHaveAttribute("data-stale", "false");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([401, 403, 404])("clears all metrics when access becomes unavailable (%i)", async (status) => {
    fetchMock.mockResolvedValueOnce(response({ error: "Unavailable" }, status));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    await advance(15_000);
    for (const metric of ["live", "audience", "revenue"]) {
      expect(screen.getByTestId(metric)).toHaveTextContent(/^—$/);
    }
    expect(screen.getByTestId("funnel")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("users-map")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("session-timeline")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("devices")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("regions")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("attendants")).toHaveTextContent("Unavailable");
    expect(screen.getByTestId("audience-chart")).toHaveTextContent("Unavailable");
    expect(screen.getByRole("status")).toHaveTextContent("Check your session and webinar access");
    await advance(15_000);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    null,
    { ...initial, online: "0" },
    { ...initial, online: -1 },
    { ...initial, updatedAt: "invalid", online: 0 },
  ])("does not replace the last snapshot with a malformed response (%j)", async (body) => {
    fetchMock.mockResolvedValueOnce(response(body));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    await advance(15_000);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.getByRole("status")).toHaveTextContent("Showing the last reading");
  });

  it("aborts a stalled request after 10 seconds and retries at the next interval", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      signal = options?.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    await advance(15_000);
    expect(signal?.aborted).toBe(false);
    await advance(10_000);
    expect(signal?.aborted).toBe(true);
    expect(screen.getByTestId("live")).toHaveTextContent("24");
    expect(screen.getByRole("status")).toHaveTextContent("Showing the last reading");
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("aborts on unmount and removes timer and foreground listeners", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      signal = options?.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const { unmount } = render(<RealtimeDashboardV5 webinarId="one" initialSnapshot={initial} />);
    fireEvent.focus(window);
    expect(signal?.aborted).toBe(false);
    unmount();
    await settle();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
