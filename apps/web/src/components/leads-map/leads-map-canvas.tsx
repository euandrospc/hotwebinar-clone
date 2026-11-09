"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { LEADS_CLUSTER_THRESHOLD, type LeadPin } from "@/lib/leads-map-aggregate";

const PIN_ICON = L.divIcon({
  className: "hw-pin",
  html: `<span style="display:block;width:14px;height:14px;border:2px solid white;border-radius:50%;background:#538743;box-shadow:0 1px 6px #173f2633"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const ptDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function PinPopup({ pin }: { pin: LeadPin }) {
  return (
    <Popup>
      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
        <strong>{pin.name}</strong>
        <br />
        {pin.email}
        <br />
        {[pin.city, pin.region, pin.country].filter(Boolean).join(", ") || "—"}
        <br />
        <span style={{ color: "#6b7280" }}>
          {ptDate.format(new Date(pin.createdAtIso))}
        </span>
      </div>
    </Popup>
  );
}

export function LeadsMapCanvas({ pins }: { pins: LeadPin[] }) {
  const markers = pins.map((p) => (
    <Marker key={p.id} position={[p.lat, p.lng]} icon={PIN_ICON}>
      <PinPopup pin={p} />
    </Marker>
  ));

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70">
      <MapContainer
        center={[-15, -55]}
        zoom={3}
        scrollWheelZoom
        style={{ height: 420 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.length >= LEADS_CLUSTER_THRESHOLD ? (
          <MarkerClusterGroup chunkedLoading>{markers}</MarkerClusterGroup>
        ) : (
          markers
        )}
      </MapContainer>
    </div>
  );
}
