"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { LEADS_CLUSTER_THRESHOLD, type LeadPin } from "@/lib/leads-map-aggregate";

const PIN_ICON = L.divIcon({
  className: "hw-pin",
  html: `<div style="font-size: 22px; line-height: 22px; transform: translate(-50%, -100%);">📍</div>`,
  iconSize: [22, 22]
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
    <div className="overflow-hidden rounded-lg border">
      <MapContainer
        center={[-15, -55]}
        zoom={3}
        scrollWheelZoom
        style={{ height: 600 }}
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
