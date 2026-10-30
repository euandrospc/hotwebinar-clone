import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RealtimeDashboard } from "@/components/webinar/realtime-dashboard";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import type { RealtimeEvent, RealtimeStatus } from "@/lib/realtime-protocol";

const realtime = vi.hoisted(() => ({
  status: "fallback" as RealtimeStatus,
  onEvent: (_event: RealtimeEvent) => {},
  onResync: () => {}
}));
vi.mock("@/lib/hooks/use-realtime-channel", () => ({
  useRealtimeChannel: (_scope: unknown, onEvent: typeof realtime.onEvent, onResync: () => void) => {
    realtime.onEvent = onEvent;
    realtime.onResync = onResync;
    return { status: realtime.status, emitPresence: vi.fn() };
  }
}));

vi.mock("@/components/webinar/realtime-map", () => ({
  RealtimeMap: ({ locations }: { locations: WebinarRealtimeSnapshot["locations"] }) => (
    <ul aria-label="Marcadores do mapa">
      {locations.map((location) => <li key={location.id}>{location.city}: {location.count}</li>)}
    </ul>
  )
}));

const initialData: WebinarRealtimeSnapshot = {
  updatedAt: "2026-10-30T19:00:00.000Z",
  online: 3,
  devices: { desktop: 1, mobile: 1, tablet: 0, unknown: 1 },
  located: 2,
  unlocated: 1,
  locations: [{ id: "sp", city: "São Paulo", region: "SP", country: "BR", lat: -23.55, lng: -46.63, count: 2 }],
  topCities: [{ label: "São Paulo, SP, BR", count: 2 }],
  topCountries: [{ code: "BR", count: 2 }]
};

const nextData: WebinarRealtimeSnapshot = {
  updatedAt: "2026-10-30T19:00:15.000Z",
  online: 5,
  devices: { desktop: 1, mobile: 2, tablet: 1, unknown: 1 },
  located: 4,
  unlocated: 1,
  locations: [
    { ...initialData.locations[0], count: 3 },
    { id: "lisbon", city: "Lisboa", region: null, country: "PT", lat: 38.72, lng: -9.14, count: 1 }
  ],
  topCities: [{ label: "São Paulo, SP, BR", count: 3 }, { label: "Lisboa, PT", count: 1 }],
  topCountries: [{ code: "BR", count: 3 }, { code: "PT", count: 1 }]
};

const fetchMock = vi.fn<typeof fetch>();
let hidden = false;

function response(data: WebinarRealtimeSnapshot) {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}

function mount() {
  return render(<RealtimeDashboard webinarId="w1" title="Aula ao vivo" initialData={initialData} />);
}

function expectCount(label: string, count: number) {
  expect(within(screen.getByRole("region", { name: label })).getByText(String(count), { exact: true })).toBeInTheDocument();
}

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(initialData.updatedAt));
  hidden = false;
  realtime.status = "fallback";
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => response(nextData));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RealtimeDashboard", () => {
  it("updates immediately on a presence event and coalesces a burst for this webinar", async () => {
    realtime.status = "connected";
    mount();
    act(() => {
      realtime.onEvent({ type: "presence", webinarId: "other" });
    });
    await advance(200);
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      realtime.onEvent({ type: "presence", webinarId: "w1" });
      realtime.onEvent({ type: "presence", webinarId: "w1" });
    });
    await advance(150);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectCount("Pessoas ao vivo", 5);
    expect(screen.getByRole("status")).toHaveTextContent("Conectado ao vivo");
  });

  it("refreshes audience, devices and map from one snapshot after 15 seconds", async () => {
    const { container } = mount();
    expectCount("Pessoas ao vivo", 3);
    expect(within(screen.getByRole("list", { name: "Marcadores do mapa" })).getByText("São Paulo: 2")).toBeInTheDocument();

    await advance(14_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/webinars/w1/realtime", expect.objectContaining({ cache: "no-store" }));
    expectCount("Pessoas ao vivo", 5);
    expectCount("No mapa", 4);
    expectCount("Sem localização", 1);
    const mobileRow = within(screen.getByRole("region", { name: "Dispositivos online" })).getByText("Celular").closest("li")!;
    expect(within(mobileRow).getByText("2", { exact: true })).toBeInTheDocument();
    expect(within(mobileRow).getByText("40%")).toBeInTheDocument();
    const map = screen.getByRole("list", { name: "Marcadores do mapa" });
    expect(within(map).getByText("São Paulo: 3")).toBeInTheDocument();
    expect(within(map).getByText("Lisboa: 1")).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("datetime", nextData.updatedAt);
  });

  it("keeps the last reading visibly stale on failure and recovers on the next refresh", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    const { container } = mount();
    await advance(15_000);

    expect(screen.getByRole("alert")).toHaveTextContent("Exibindo a última leitura");
    expect(screen.getByRole("status")).toHaveTextContent("Reconectando");
    expectCount("Pessoas ao vivo", 3);
    expect(container.querySelector("time")).toHaveAttribute("datetime", initialData.updatedAt);

    await advance(15_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Atualização automática");
    expectCount("Pessoas ao vivo", 5);
    expect(container.querySelector("time")).toHaveAttribute("datetime", nextData.updatedAt);
  });

  it("does not overlap a pending refresh and aborts it when leaving the page", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = mount();
    await advance(15_000);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    expect(screen.getByRole("button", { name: "Atualizar agora" })).toBeDisabled();

    act(() => { window.dispatchEvent(new Event("focus")); });
    await advance(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(signal?.aborted).toBe(true);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pauses automatic requests while hidden and refreshes immediately when visible", async () => {
    mount();
    hidden = true;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await advance(60_000);
    expect(fetchMock).not.toHaveBeenCalled();

    hidden = false;
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectCount("Pessoas ao vivo", 5);
    await advance(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the operator retry immediately when the server refuses a refresh", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    mount();
    await advance(15_000);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expectCount("Pessoas ao vivo", 3);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" })); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectCount("Pessoas ao vivo", 5);
  });
});
