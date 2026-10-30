"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { MapPin } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

type Locations = WebinarRealtimeSnapshot["locations"];

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
    <div className="relative isolate h-[360px] sm:h-[420px]">
      <MapContainer center={[-15, -55]} zoom={3} scrollWheelZoom={false} className="h-full w-full" aria-label="Mapa dos espectadores online">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControls locations={locations} />
        {locations.map((location) => (
          <CircleMarker
            key={location.id}
            center={[location.lat, location.lng]}
            radius={Math.min(22, 7 + Math.log2(location.count + 1) * 3)}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#ef4444", fillOpacity: 0.85 }}
          >
            <Tooltip direction="top">
              <strong>{[location.city, location.region, location.country].filter(Boolean).join(", ") || "Localização aproximada"}</strong>
              <br />{location.count.toLocaleString("pt-BR")} {location.count === 1 ? "pessoa online" : "pessoas online"}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {locations.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-9 z-[500] mx-auto max-w-sm rounded-lg border bg-card/95 p-4 text-center shadow-sm">
          <p className="text-sm font-medium">Nenhuma localização ao vivo agora</p>
          <p className="mt-1 text-xs text-muted-foreground">O mapa aparece automaticamente quando há espectadores com localização disponível.</p>
        </div>
      )}
    </div>
  );
}
