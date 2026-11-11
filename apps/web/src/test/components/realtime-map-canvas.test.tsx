import { StrictMode, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { RealtimeMapCanvas } from "@/components/webinar/realtime-map-canvas";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

type Locations = WebinarRealtimeSnapshot["locations"];
type MapEvents = Record<string, (event?: { popup: object }) => void>;
const state = vi.hoisted(() => ({
  zoom: 6,
  events: {} as MapEvents,
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
  openPopup: vi.fn(),
  removePopup: vi.fn(),
  movePopup: vi.fn(),
  popupLayers: new Set<object>(),
  activePopup: null as object | null
}));

vi.mock("leaflet", () => ({
  divIcon: (options: unknown) => ({ options }),
  latLngBounds: (coordinates: unknown) => coordinates
}));

vi.mock("react-leaflet", async () => {
  const { forwardRef, useEffect, useImperativeHandle, useRef, useState } = await import("react");
  const map = {
    getZoom: () => state.zoom,
    project: ([lat, lng]: number[], zoom = state.zoom) => ({
      x: lng * 100 * 2 ** (zoom - 6), y: lat * 100 * 2 ** (zoom - 6)
    }),
    fitBounds: state.fitBounds,
    invalidateSize: state.invalidateSize,
    hasLayer: (layer: object) => state.popupLayers.has(layer),
    getContainer: () => document.getElementById("mock-map")!
  };
  const Popup = forwardRef<{ setLatLng: (coordinates: number[]) => void }, { children: ReactNode; position: number[] }>(
    function MockPopup({ children, position }, ref) {
      const [coordinates, setCoordinates] = useState(position);
      const instance = useRef({
        setLatLng(next: number[]) { state.movePopup(next); setCoordinates(next); }
      });
      useImperativeHandle(ref, () => instance.current, []);
      // Match react-leaflet's standalone Popup lifecycle: a new position prop
      // reference removes/reopens its layer and emits popupclose on the map.
      useEffect(() => {
        const layer = instance.current;
        state.popupLayers.add(layer);
        state.activePopup = layer;
        state.openPopup();
        setCoordinates(position);
        return () => {
          state.popupLayers.delete(layer);
          state.removePopup();
          state.events.popupclose?.({ popup: layer });
        };
      }, [position]);
      return <div role="dialog" aria-label="Pessoa no mapa" data-position={JSON.stringify(coordinates)}>{children}</div>;
    }
  );

  return {
    MapContainer: ({ children, scrollWheelZoom }: { children: ReactNode; scrollWheelZoom: boolean }) => (
      <div id="mock-map" data-testid="map" data-wheel-zoom={String(scrollWheelZoom)}>{children}</div>
    ),
    TileLayer: () => null,
    Marker: ({ children, position, title, keyboard, icon, eventHandlers }: {
      children: ReactNode; position: number[]; title: string; keyboard: boolean;
      icon: { options: { iconAnchor: number[]; popupAnchor: number[]; tooltipAnchor: number[] } };
      eventHandlers: { click?: () => void; keydown?: (event: { originalEvent: ReactKeyboardEvent<HTMLButtonElement> }) => void };
    }) => <div data-testid="pin" data-position={JSON.stringify(position)} data-icon-anchor={JSON.stringify(icon.options.iconAnchor)}
      data-popup-anchor={JSON.stringify(icon.options.popupAnchor)} data-tooltip-anchor={JSON.stringify(icon.options.tooltipAnchor)}>
      <button type="button" aria-label={title} tabIndex={keyboard ? 0 : -1} onClick={eventHandlers.click}
        onKeyDown={(event) => eventHandlers.keydown?.({ originalEvent: event })}>{title}</button>
      {children}
    </div>,
    Tooltip: ({ children }: { children: ReactNode }) => <span role="tooltip">{children}</span>,
    Popup,
    useMap: () => map,
    useMapEvents: (events: MapEvents) => { state.events = events; return map; }
  };
});

function person(id: string, name: string, overrides: Partial<Locations[number]> = {}): Locations[number] {
  return { id, name, lat: -22.9, lng: -43.17, city: "Rio de Janeiro", region: "RJ", country: "BR", count: 1, ...overrides };
}

const colocated = [person("ana", "Ana"), person("bruno", "Bruno"), person("carla", "Carla")];

beforeEach(() => {
  vi.clearAllMocks();
  state.zoom = 6;
  state.events = {};
  state.popupLayers.clear();
  state.activePopup = null;
});
afterEach(async () => { await act(async () => { cleanup(); }); });

describe("RealtimeMapCanvas geographic pin accuracy", () => {
  it("renders 256 coastal viewers as individual pins anchored to their source location", () => {
    const locations = Array.from({ length: 256 }, (_, index) => person(`viewer-${index}`, `Pessoa ${index}`));
    const original = structuredClone(locations);
    render(<RealtimeMapCanvas locations={locations} />);

    const pins = screen.getAllByTestId("pin");
    expect(pins).toHaveLength(256);
    for (const pin of pins) {
      expect(pin).toHaveAttribute("data-position", "[-22.9,-43.17]");
      expect(pin).toHaveAttribute("data-icon-anchor", "[8,22]");
      expect(pin).toHaveAttribute("data-popup-anchor", "[0,-22]");
      expect(pin).toHaveAttribute("data-tooltip-anchor", "[0,-22]");
      expect(within(pin).getByRole("button")).toHaveAttribute("tabindex", "0");
    }
    expect(locations).toEqual(original);
    expect(screen.getByTestId("map")).toHaveAttribute("data-wheel-zoom", "true");
  });

  it("lets an operator cycle every overlapping person without moving any pin", () => {
    render(<RealtimeMapCanvas locations={[...colocated, person("far", "Pessoa distante", { lat: 0, lng: 0 })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Bruno" }));
    const popup = screen.getByRole("dialog");
    expect(popup).toHaveTextContent("Bruno");
    expect(popup).toHaveTextContent("2 de 3");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(within(popup).getByRole("button", { name: "Próxima pessoa" }));
    expect(popup).toHaveTextContent("Carla");
    expect(popup).toHaveTextContent("3 de 3");
    fireEvent.click(within(popup).getByRole("button", { name: "Próxima pessoa" }));
    expect(popup).toHaveTextContent("Ana");
    expect(popup).toHaveTextContent("1 de 3");
    fireEvent.click(within(popup).getByRole("button", { name: "Pessoa anterior" }));
    expect(popup).toHaveTextContent("Carla");
    expect(popup).not.toHaveTextContent("Pessoa distante");
    expect(screen.getAllByTestId("pin")).toHaveLength(4);
  });

  it.each(["Enter", " "])("opens and changes a person with %j, prevents scrolling and closes with Escape", async (key) => {
    render(<RealtimeMapCanvas locations={colocated} />);
    const anaPin = screen.getByRole("button", { name: "Ana" });
    anaPin.focus();
    const openEvent = createEvent.keyDown(anaPin, { key, bubbles: true, cancelable: true });
    fireEvent(anaPin, openEvent);
    expect(openEvent.defaultPrevented).toBe(true);
    expect(screen.getByRole("dialog")).toHaveTextContent("Ana");

    const brunoPin = screen.getByRole("button", { name: "Bruno" });
    brunoPin.focus();
    const switchEvent = createEvent.keyDown(brunoPin, { key, bubbles: true, cancelable: true });
    fireEvent(brunoPin, switchEvent);
    expect(switchEvent.defaultPrevented).toBe(true);
    expect(screen.getByRole("dialog")).toHaveTextContent("Bruno");
    expect(screen.getByRole("dialog")).toHaveTextContent("2 de 3");

    await act(async () => { fireEvent.keyDown(brunoPin, { key: "Escape" }); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tooltip")).toHaveLength(3);
  });

  it("keeps selection across reordered refreshes and never displays an offline person", async () => {
    const { rerender } = render(<RealtimeMapCanvas locations={colocated} />);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima pessoa" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Bruno");

    rerender(<RealtimeMapCanvas locations={[colocated[2], { ...colocated[1], name: "Bruno atualizado" }, colocated[0]]} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Bruno atualizado");
    expect(state.fitBounds).toHaveBeenCalledTimes(1);

    rerender(<RealtimeMapCanvas locations={[colocated[0], colocated[2]]} />);
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Bruno");
    expect(screen.getByRole("dialog")).toHaveTextContent("Ana");
    expect(screen.getAllByTestId("pin")).toHaveLength(2);

    await act(async () => { rerender(<RealtimeMapCanvas locations={[]} />); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pin")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma localização ao vivo agora")).toBeInTheDocument();
  });

  it("moves the open popup between nearby coordinates without closing it on selection or polling", () => {
    const ana = colocated[0];
    const bruno = person("bruno", "Bruno", { lng: -43.07 });
    const { rerender } = render(<RealtimeMapCanvas locations={[ana, bruno]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    const popup = screen.getByRole("dialog");
    expect(popup).toHaveAttribute("data-position", "[-22.9,-43.17]");
    expect(state.openPopup).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Próxima pessoa" }));
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(popup).toHaveTextContent("Bruno");
    expect(popup).toHaveAttribute("data-position", "[-22.9,-43.07]");
    expect(state.movePopup).toHaveBeenLastCalledWith([-22.9, -43.07]);
    expect(state.removePopup).not.toHaveBeenCalled();

    rerender(<RealtimeMapCanvas locations={[
      { ...bruno, name: "Bruno atualizado", lat: -22.89, lng: -43.06 }, { ...ana }
    ]} />);
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(popup).toHaveTextContent("Bruno atualizado");
    expect(popup).toHaveAttribute("data-position", "[-22.89,-43.06]");
    expect(state.movePopup).toHaveBeenLastCalledWith([-22.89, -43.06]);
    expect(state.removePopup).not.toHaveBeenCalled();
    expect(state.openPopup).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("pin").map((pin) => pin.getAttribute("data-position")))
      .toEqual(["[-22.89,-43.06]", "[-22.9,-43.17]"]);

    fireEvent.click(screen.getByRole("button", { name: "Próxima pessoa" }));
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(popup).toHaveTextContent("Ana");
    expect(popup).toHaveAttribute("data-position", "[-22.9,-43.17]");
    expect(state.removePopup).not.toHaveBeenCalled();
  });

  it("keeps a popup reopened by Strict Mode selected but clears a genuinely closed popup", async () => {
    render(<StrictMode><RealtimeMapCanvas locations={colocated} /></StrictMode>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ana" })); });
    const popup = screen.getByRole("dialog");
    expect(popup).toHaveTextContent("Ana");
    expect(state.openPopup).toHaveBeenCalledTimes(2);
    expect(state.removePopup).toHaveBeenCalledTimes(1);
    expect(state.popupLayers.has(state.activePopup!)).toBe(true);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Próxima pessoa" })); });
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(popup).toHaveTextContent("Bruno");

    await act(async () => {
      const layer = state.activePopup!;
      state.popupLayers.delete(layer);
      state.events.popupclose({ popup: layer });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tooltip")).toHaveLength(3);
  });

  it("keeps the active viewer when the originally clicked viewer goes offline", () => {
    const { rerender } = render(<RealtimeMapCanvas locations={colocated} />);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima pessoa" }));

    rerender(<RealtimeMapCanvas locations={[colocated[1], colocated[2]]} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Bruno");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Ana");
  });

  it("closes selection on zoom and recalculates overlap without shifting geographic positions", async () => {
    const nearby = person("bruno", "Bruno", { lng: -43.07 });
    render(<RealtimeMapCanvas locations={[colocated[0], nearby]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("1 de 2");

    await act(async () => { state.events.zoomstart(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => { state.zoom = 8; state.events.zoomend(); });
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Ana");
    expect(screen.queryByRole("button", { name: "Próxima pessoa" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("pin").map((pin) => pin.getAttribute("data-position"))).toEqual(["[-22.9,-43.17]", "[-22.9,-43.07]"]);
  });
});
