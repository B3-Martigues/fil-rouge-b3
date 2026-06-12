import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import EventMarker from "./EventMarker";
import UserLocationMarker from "./UserLocationMarker";
import type { UserPosition } from "../hooks/useUserLocation";
import MapFitBounds from "./MapFitBounds";
import { hasEventCoordinates } from "../utils/event";
import useDataStore from "../../../shared/store/dataStore";
import type { Event } from "../types/event";

type EventMapProps = {
  events: Event[];
  selectedEventId?: number | null;
  selectedEventRequestId?: number;
  userPosition?: UserPosition | null;
  showPopups?: boolean;
  onEventSelect?: (eventId: number) => void;
};

type MappableEvent = Event & { latitude: number; longitude: number };

type SelectedEventFocusProps = {
  event: MappableEvent | null;
  requestId: number;
  onFocusStart: () => void;
  onFocusDone: (eventId: number) => void;
};

const SELECTED_EVENT_ZOOM = 16;
const HOME_MAP_READY_EVENT = "mappening:home-map-ready";

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
  userPosition = null,
  showPopups = true,
  onEventSelect,
}: EventMapProps) {
  const organizations = useDataStore((s) => s.organizations);
  const [openPopupEventId, setOpenPopupEventId] = useState<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [areTilesLoaded, setAreTilesLoaded] = useState(false);
  const hasAnnouncedReady = useRef(false);
  const activeOrganizationsById = useMemo(
    () =>
      new Map(
        organizations
          .filter((organization) => organization.is_active && !organization.deleted_at)
          .map((organization) => [organization.id, organization]),
      ),
    [organizations],
  );
  const mappableEvents = useMemo(
    () =>
      events
        .map((event) => {
          if (hasEventCoordinates(event)) return event;

          const organization = activeOrganizationsById.get(event.organization_id);

          if (
            organization?.latitude == null ||
            organization.longitude == null
          ) {
            return null;
          }

          return {
            ...event,
            latitude: organization.latitude,
            longitude: organization.longitude,
          };
        })
        .filter(
          (event): event is MappableEvent => event != null,
        ),
    [activeOrganizationsById, events],
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
      ...(userPosition ? [userPosition] : []),
    ],
    [mappableEvents, userPosition],
  );
  const handleFocusStart = useCallback(() => {
    setOpenPopupEventId(null);
  }, []);
  const handleFocusDone = useCallback((eventId: number) => {
    setOpenPopupEventId(eventId);
  }, []);
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);
  const handleTilesLoaded = useCallback(() => {
    setAreTilesLoaded(true);
  }, []);

  useEffect(() => {
    if (!isMapReady || !areTilesLoaded || hasAnnouncedReady.current) return;

    const readyTimer = window.setTimeout(() => {
      hasAnnouncedReady.current = true;
      window.dispatchEvent(new Event(HOME_MAP_READY_EVENT));
    }, 350);

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, [areTilesLoaded, isMapReady]);

  const activeOpenPopupEventId = selectedEvent ? openPopupEventId : null;

  return (
    <MapContainer
      center={[43.2965, 5.3698]}
      className="event-map"
      zoom={13}
      scrollWheelZoom={true}
      whenReady={handleMapReady}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        eventHandlers={{ load: handleTilesLoaded }}
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
          showPopup={showPopups}
          onSelect={onEventSelect}
        />
      ))}
      {userPosition && (
        <UserLocationMarker
          latitude={userPosition.latitude}
          longitude={userPosition.longitude}
        />
      )}
    </MapContainer>
  );
}
