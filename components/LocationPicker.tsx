"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Coordinates = { latitude: number; longitude: number };

function ClickHandler({ onChange }: { onChange: (coordinates: Coordinates) => void }) {
  useMapEvents({ click: event => onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng }) });
  return null;
}

function Recenter({ coordinates }: { coordinates: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates) map.setView([coordinates.latitude, coordinates.longitude], Math.max(map.getZoom(), 15));
  }, [coordinates, map]);
  return null;
}

export default function LocationPicker({ coordinates, onChange }: { coordinates: Coordinates | null; onChange: (coordinates: Coordinates) => void }) {
  const center: [number, number] = coordinates ? [coordinates.latitude, coordinates.longitude] : [-6.2088, 106.8456];
  return (
    <div className="locationPicker">
      <MapContainer center={center} zoom={coordinates ? 15 : 11} scrollWheelZoom style={{ height: "310px", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onChange={onChange} />
        <Recenter coordinates={coordinates} />
        {coordinates && <CircleMarker center={[coordinates.latitude, coordinates.longitude]} radius={10} pathOptions={{ color: "#0f766e", fillColor: "#34d399", fillOpacity: .9 }}><Popup>Selected observation location</Popup></CircleMarker>}
      </MapContainer>
    </div>
  );
}
