import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import EventMarker from "./EventMarker";
import UserLocationMarker from "./UserLocationMarker";
import useUserLocation from "../hooks/useUserLocation";
import MapFitBounds from "./MapFitBounds";
import { hasEventCoordinates } from "../utils/event";
import useDataStore from "../../../shared/store/dataStore";
import type { Event } from "../types/event";

type EventMapProps = {
  events: Event[];
  selectedEventId?: number | null;
  selectedEventRequestId?: number;
};

type MappableEvent = Event & { latitude: number; longitude: number };

type SelectedEventFocusProps = {
  event: MappableEvent | null;
  requestId: number;
  onFocusStart: () => void;
  onFocusDone: (eventId: number) => void;
};

const SELECTED_EVENT_ZOOM = 16;

function SelectedEventFocus({
  event,
  requestId,
  onFocusStart,
  onFocusDone,
}: SelectedEventFocusProps) {
  const map = useMap();

  useEffect(() => {
    if (!event) return;

    let hasOpenedPopup = false;
    const openPopup = () => {
      if (hasOpenedPopup) return;

      hasOpenedPopup = true;
      onFocusDone(event.id);
    };

    onFocusStart();
    map.closePopup();
    map.flyTo(
      [event.latitude, event.longitude],
      Math.max(map.getZoom(), SELECTED_EVENT_ZOOM),
      { animate: true, duration: 0.7 },
    );
    map.once("moveend", openPopup);

    const fallbackId = window.setTimeout(openPopup, 900);

    return () => {
      map.off("moveend", openPopup);
      window.clearTimeout(fallbackId);
    };
  }, [event, map, onFocusDone, onFocusStart, requestId]);

  return null;
}

export default function EventMap({
  events,
  selectedEventId = null,
  selectedEventRequestId = 0,
}: EventMapProps) {
  const { position } = useUserLocation();
  const companies = useDataStore((s) => s.companies);
  const [openPopupEventId, setOpenPopupEventId] = useState<number | null>(null);
  const activeCompaniesById = useMemo(
    () =>
      new Map(
        companies
          .filter((company) => company.is_active && !company.deleted_at)
          .map((company) => [company.id, company]),
      ),
    [companies],
  );
  const mappableEvents = useMemo(
    () =>
      events
        .map((event) => {
          if (hasEventCoordinates(event)) return event;

          const company = activeCompaniesById.get(event.company_id);

          if (
            company?.latitude == null ||
            company.longitude == null
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
          (event): event is MappableEvent => event != null,
        ),
    [activeCompaniesById, events],
  );
  const selectedEvent = useMemo(
    () =>
      selectedEventId == null
        ? null
        : mappableEvents.find((event) => event.id === selectedEventId) ?? null,
    [mappableEvents, selectedEventId],
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
  const handleFocusStart = useCallback(() => {
    setOpenPopupEventId(null);
  }, []);
  const handleFocusDone = useCallback((eventId: number) => {
    setOpenPopupEventId(eventId);
  }, []);

  const activeOpenPopupEventId = selectedEvent ? openPopupEventId : null;

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
      <SelectedEventFocus
        event={selectedEvent}
        requestId={selectedEventRequestId}
        onFocusStart={handleFocusStart}
        onFocusDone={handleFocusDone}
      />
      {mappableEvents.map((event) => (
        <EventMarker
          key={event.id}
          event={event}
          shouldOpenPopup={activeOpenPopupEventId === event.id}
        />
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
