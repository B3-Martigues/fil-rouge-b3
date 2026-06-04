import { useEffect, useRef } from "react";
import type { Marker as LeafletMarker } from "leaflet";
import { Marker } from "react-leaflet";

import type { Event } from "../types/event-categories";
import EventPopup from "./EventPopup";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

type Props = {
  event: Event & { latitude: number; longitude: number };
  shouldOpenPopup?: boolean;
};

export default function EventMarker({ event, shouldOpenPopup = false }: Props) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const currentUser = useAuthStore((s) => s.currentUser);
  const recordHistory = useDataStore((s) => s.recordHistory);

  useEffect(() => {
    if (shouldOpenPopup) {
      markerRef.current?.openPopup();
    }
  }, [shouldOpenPopup]);

  const handleMarkerClick = () => {
    if (currentUser?.role === "user" && currentUser.user_id) {
      recordHistory(currentUser.user_id, event.id);
    }
  };

  return (
    <Marker
      ref={markerRef}
      position={[event.latitude, event.longitude]}
      eventHandlers={{ click: handleMarkerClick }}
    >
      <EventPopup event={event} />
    </Marker>
  );
}
