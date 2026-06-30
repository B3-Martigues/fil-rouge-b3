import { useEffect, useMemo, useRef } from "react";
import { Icon, type Marker as LeafletMarker } from "leaflet";
import { Marker } from "react-leaflet";

import type { Event } from "../types/event-categories";
import EventPopup from "./EventPopup";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import { eventsApi } from "../api/events.api";

type Props = {
  event: Event & { latitude: number; longitude: number };
  shouldOpenPopup?: boolean;
  showPopup?: boolean;
  onSelect?: (eventId: number) => void;
  onImageError?: (eventId: number) => void;
};

export default function EventMarker({
  event,
  shouldOpenPopup = false,
  showPopup = true,
  onSelect,
  onImageError,
}: Props) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const recordHistory = useDataStore((s) => s.recordHistory);
  const upsertHistory = useDataStore((s) => s.upsertHistory);
  const eventIcon = useMemo(
    () =>
      new Icon({
        iconUrl: event.image,
        iconSize: [54, 54],
        iconAnchor: [27, 54],
        popupAnchor: [0, -54],
        className: "event-map-marker",
      }),
    [event.image],
  );

  useEffect(() => {
    if (shouldOpenPopup) {
      markerRef.current?.openPopup();
    }
  }, [shouldOpenPopup]);

  const handleMarkerClick = () => {
    if (currentUser?.role === "user" && currentUser.user_id) {
      recordHistory(currentUser.user_id, event.id);
      if (currentUser.auth_source === "api") {
        void eventsApi.recordHistory(event.id).then((result) => {
          if (result.ok) {
            upsertHistory(result.data);
          }
        });
      }
    }

    onSelect?.(event.id);
  };

  return (
    <Marker
      icon={eventIcon}
      ref={markerRef}
      position={[event.latitude, event.longitude]}
      eventHandlers={{ click: handleMarkerClick }}
    >
      {showPopup && <EventPopup event={event} onImageError={onImageError} />}
    </Marker>
  );
}
