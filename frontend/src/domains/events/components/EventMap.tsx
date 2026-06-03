import { MapContainer, TileLayer } from "react-leaflet";
import { useMemo } from "react";

import EventMarker from "./EventMarker";
import UserLocationMarker from "./UserLocationMarker";
import useUserLocation from "../hooks/useUserLocation";
import MapFitBounds from "./MapFitBounds";
import {
  getEventStatus,
  hasEventCoordinates,
  isEventInPeriod,
} from "../utils/event";
import useDataStore from "../../../shared/store/dataStore";
import type { Event } from "../types/event";

type EventMapProps = {
  periodStart: Date;
  periodEnd: Date;
};

export default function EventMap({ periodStart, periodEnd }: EventMapProps) {
  const { position } = useUserLocation();
  const events = useDataStore((s) => s.events);
  const companies = useDataStore((s) => s.companies);
  const mappableEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.is_active &&
            !event.deleted_at &&
            getEventStatus(event) !== "past" &&
            isEventInPeriod(event, periodStart, periodEnd),
        )
        .map((event) => {
          if (hasEventCoordinates(event)) return event;

          const company = companies.find(
            (item) => item.id === event.company_id && !item.deleted_at,
          );

          if (
            company?.latitude == null ||
            company.longitude == null ||
            !company.is_active
          ) {
            return null;
          }

          return {
            ...event,
            latitude: company.latitude,
            longitude: company.longitude,
          };
        })
        .filter(
          (event): event is Event & { latitude: number; longitude: number } =>
            event != null,
        ),
    [companies, events, periodEnd, periodStart],
  );
  const mapPoints = useMemo(
    () => [
      ...mappableEvents.map((event) => ({
        latitude: event.latitude,
        longitude: event.longitude,
      })),
      ...(position ? [position] : []),
    ],
    [mappableEvents, position],
  );

  return (
    <MapContainer
      center={[43.2965, 5.3698]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitBounds points={mapPoints} />
      {mappableEvents.map((event) => (
        <EventMarker key={event.id} event={event} />
      ))}
      {position && (
        <UserLocationMarker
          latitude={position.latitude}
          longitude={position.longitude}
        />
      )}
    </MapContainer>
  );
}
