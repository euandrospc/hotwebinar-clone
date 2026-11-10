"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { Marker, Polyline, MapContainer, TileLayer, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import { MapPin } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import { separateMapPins } from "@/lib/map-pin-layout";
import styles from "./realtime-map.module.css";

type Locations = WebinarRealtimeSnapshot["locations"];

const PIN_HTML = '<svg width="16" height="22" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 21S1 13.5 1 8a7 7 0 1 1 14 0c0 5.5-7 13-7 13Z" fill="#12664D" stroke="white" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#D6EDB8"/></svg>';

function AudiencePins({ locations }: { locations: Locations }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // MapControls can fit the initial bounds before this listener is attached.
  useEffect(() => { setZoom(map.getZoom()); }, [map]);
  const pins = useMemo(() => {
    const points = locations.map((location) => ({ id: location.id, ...map.project([location.lat, location.lng], zoom) }));
    const offsets = separateMapPins(points);
    return locations.map((location) => {
      const offset = offsets.get(location.id)!;
      const origin = map.project([location.lat, location.lng], zoom);
      const displayPosition = map.unproject([origin.x + offset.x, origin.y + offset.y], zoom);
      return {
        location,
        displayPosition,
        shifted: Math.hypot(offset.x, offset.y) > 1,
        icon: divIcon({
          className: "realtime-person-pin",
          html: PIN_HTML,
          iconSize: [16, 22],
          iconAnchor: [8 - offset.x, 22 - offset.y],
          popupAnchor: [offset.x, offset.y - 22],
          tooltipAnchor: [offset.x, offset.y - 22]
        })
      };
    });
  }, [locations, map, zoom]);

  return <>
    {pins.filter((pin) => pin.shifted && pin.location.id === (hoveredId ?? selectedId)).map(({ location, displayPosition }) => (
      <Polyline key={`line-${location.id}`} positions={[[location.lat, location.lng], displayPosition]}
        interactive={false} pathOptions={{ color: "#12664D", weight: 1, opacity: 0.65, dashArray: "3 4" }} />
    ))}
    {pins.map(({ location, icon, shifted }) => {
      const name = location.name || "Espectador sem nome";
      const place = [location.city, location.region, location.country].filter(Boolean).join(", ") || "Localização aproximada";
      return <Marker key={location.id} position={[location.lat, location.lng]} icon={icon} title={name} alt={name} keyboard
        eventHandlers={{
          mouseover: () => setHoveredId(location.id),
          mouseout: () => setHoveredId(null),
          popupopen: () => setSelectedId(location.id),
          popupclose: () => setSelectedId(null)
        }}>
        <Tooltip direction="top"><strong>{name}</strong><br />{place}</Tooltip>
        <Popup autoPanPaddingTopLeft={[12, 64]} autoPanPaddingBottomRight={[12, 60]}>
          <div className="text-xs leading-relaxed"><strong>{name}</strong><br />{place}
            <p className="!mb-0 !mt-2 text-[11px] text-muted-foreground">Localização aproximada.{shifted && " Pin separado visualmente para facilitar a seleção."}</p>
          </div>
        </Popup>
      </Marker>;
    })}
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
    <div className="absolute right-3 top-3 z-[500]">
      <Button variant="outline" size="sm" disabled={!locations.length} onClick={fitLocations}>
        <MapPin className="h-4 w-4" /> Centralizar mapa
      </Button>
    </div>
  );
}

export function RealtimeMapCanvas({ locations }: { locations: Locations }) {
  return (
    <div className="relative isolate h-[300px] sm:h-[350px]">
      <MapContainer center={[-15, -55]} zoom={3} scrollWheelZoom className="h-full w-full" aria-label="Mapa dos espectadores online">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControls locations={locations} />
        <AudiencePins locations={locations} />
      </MapContainer>
      {locations.length > 0 && <div className={styles.legend}>1 pin por pessoa · pins próximos aparecem lado a lado</div>}
      {locations.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-9 z-[500] mx-auto max-w-sm rounded-lg border bg-card/95 p-3 text-center shadow-sm">
          <p className="text-xs font-medium">Nenhuma localização ao vivo agora</p>
          <p className="mt-1 text-xs text-muted-foreground">O mapa aparece automaticamente quando há espectadores com localização disponível.</p>
        </div>
      )}
    </div>
  );
}
