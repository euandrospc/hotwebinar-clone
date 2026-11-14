"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds, type Popup as LeafletPopup } from "leaflet";
import { Marker, MapContainer, TileLayer, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import { ArrowLeft, ArrowRight, Target } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import { findOverlappingMapPins } from "@/lib/map-pin-layout";
import styles from "./realtime-map.module.css";

type Locations = WebinarRealtimeSnapshot["locations"];

const PIN_HTML = '<svg width="16" height="22" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 21S1 13.5 1 8a7 7 0 1 1 14 0c0 5.5-7 13-7 13Z" fill="#12664D" stroke="white" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#D6EDB8"/></svg>';

function PersonPopup({ person, index, total, onSelect }: {
  person: Locations[number]; index: number; total: number; onSelect: (direction: number) => void;
}) {
  const popup = useRef<LeafletPopup>(null);
  // React Leaflet reopens the overlay when its position prop changes identity.
  // Keep its lifecycle stable while cycling people or receiving a new snapshot.
  const initialPosition = useRef<[number, number]>([person.lat, person.lng]);
  useEffect(() => { popup.current?.setLatLng([person.lat, person.lng]); }, [person.lat, person.lng]);

  return <Popup ref={popup} position={initialPosition.current} offset={[0, -22]}
    autoPanPaddingTopLeft={[12, 64]} autoPanPaddingBottomRight={[12, 60]}>
    <div className={styles.person}>
      <div aria-live="polite" aria-atomic="true">
        <strong>{person.name || "Espectador sem nome"}</strong>
        <div>{[person.city, person.region, person.country].filter(Boolean).join(", ") || "Localização indisponível"}</div>
        <p className={styles.hint}>Localização aproximada por IP.</p>
      </div>
      {total > 1 && <div className={styles.overlapControls}>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Pessoa anterior" onClick={() => onSelect(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className={styles.overlapCount}>{index + 1} de {total}<span>Pins sobrepostos</span></span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Próxima pessoa" onClick={() => onSelect(1)}>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>}
    </div>
  </Popup>;
}

function AudiencePins({ locations }: { locations: Locations }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [selection, setSelection] = useState<{ anchorId: string; activeId: string } | null>(null);
  useMapEvents({
    zoomstart: () => setSelection(null),
    zoomend: () => setZoom(map.getZoom()),
    popupclose: (event) => {
      // Strict Mode briefly removes/reopens overlays while mounting. Only clear
      // selection if it is still closed after the lifecycle has settled.
      queueMicrotask(() => { if (!map.hasLayer(event.popup)) setSelection(null); });
    }
  });
  // MapControls can fit the initial bounds before this listener is attached.
  useEffect(() => { setZoom(map.getZoom()); }, [map]);
  // The tip always stays at the received coordinate, including dense/coastal cities.
  const icon = useMemo(() => divIcon({
    className: "realtime-person-pin",
    html: PIN_HTML,
    iconSize: [16, 22],
    iconAnchor: [8, 22],
    popupAnchor: [0, -22],
    tooltipAnchor: [0, -22]
  }), []);
  const points = useMemo(() => locations.map((location) => ({
    id: location.id, ...map.project([location.lat, location.lng], zoom)
  })), [locations, map, zoom]);
  const locationsById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const overlapping = useMemo(() => {
    if (!selection) return [];
    const anchorId = locationsById.has(selection.anchorId) ? selection.anchorId : selection.activeId;
    return findOverlappingMapPins(points, anchorId).map((point) => locationsById.get(point.id)!);
  }, [points, locationsById, selection]);
  const selected = overlapping.find((location) => location.id === selection?.activeId) ?? overlapping[0];
  const selectedIndex = selected ? overlapping.findIndex((location) => location.id === selected.id) : -1;

  useEffect(() => {
    if (selection && !selected) setSelection(null);
  }, [selection, selected]);

  function selectPerson(direction: number) {
    const next = overlapping[(selectedIndex + direction + overlapping.length) % overlapping.length];
    setSelection({ anchorId: selection!.anchorId, activeId: next.id });
  }

  return <>
    {locations.map((location) => {
      const name = location.name || "Espectador sem nome";
      const place = [location.city, location.region, location.country].filter(Boolean).join(", ") || "Localização aproximada";
      return <Marker key={location.id} position={[location.lat, location.lng]} icon={icon} title={name}
        alt={`${name} · ${place}`} keyboard zIndexOffset={selected?.id === location.id ? 1000 : 0}
        eventHandlers={{
          click: () => setSelection({ anchorId: location.id, activeId: location.id }),
          keydown: (event) => {
            if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") {
              event.originalEvent.preventDefault();
              setSelection({ anchorId: location.id, activeId: location.id });
            } else if (event.originalEvent.key === "Escape") {
              setSelection(null);
            }
          }
        }}>
        {!selected && <Tooltip direction="top"><strong>{name}</strong><br />{place}</Tooltip>}
      </Marker>;
    })}
    {selected && <PersonPopup person={selected} index={selectedIndex} total={overlapping.length} onSelect={selectPerson} />}
  </>;
}

function MapControls({ locations }: { locations: Locations }) {
  const map = useMap();
  const fitted = useRef(false);

  function fitLocations() {
    if (!locations.length) return;
    map.fitBounds(latLngBounds(locations.map((location) => [location.lat, location.lng])), {
      padding: [40, 40], maxZoom: 6, animate: false
    });
  }

  useEffect(() => {
    if (!locations.length) fitted.current = false;
    if (!fitted.current && locations.length) {
      fitLocations();
      fitted.current = true;
    }
    // Keep the viewer's zoom and position while the audience refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, map]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return (
    <div className="absolute right-4 top-4 z-[500]">
      <button type="button" disabled={!locations.length} onClick={fitLocations}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#3A3F3B]/90 px-3 py-2 text-xs text-neutral-100 shadow-sm backdrop-blur-sm transition-colors hover:bg-[#3A3F3B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-palco disabled:cursor-not-allowed disabled:opacity-80 motion-reduce:transition-none">
        <Target aria-hidden="true" className="h-3 w-3" /> Centralizar mapa
      </button>
    </div>
  );
}

export function RealtimeMapCanvas({ locations }: { locations: Locations }) {
  return (
    <div className="relative isolate h-full">
      <MapContainer center={[-15, -55]} zoom={3} scrollWheelZoom className="h-full w-full" aria-label="Mapa dos espectadores online">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControls locations={locations} />
        <AudiencePins locations={locations} />
      </MapContainer>
      {locations.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-9 z-[500] mx-auto flex max-w-xs flex-col gap-1 rounded-lg bg-[#111311]/95 p-3 text-center shadow-lg">
          <p className="text-xs font-semibold text-neutral-100">Nenhuma localização ao vivo agora</p>
          <p className="text-[11px] text-[#9AA39C]">O mapa aparece automaticamente quando há espectadores com localização disponível.</p>
        </div>
      )}
    </div>
  );
}
