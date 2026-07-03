import { memo, useEffect, useMemo, useRef } from "react";
import { Icon, type Marker as LeafletMarker } from "leaflet";
import { Marker } from "react-leaflet";

import type { Event } from "../types/event-categories";
import { getEventThumbnailUrl } from "../utils/event";
import EventPopup from "./EventPopup";

type Props = {
  event: Event & { latitude: number; longitude: number };
  shouldOpenPopup?: boolean;
  showPopup?: boolean;
  onSelect?: (eventId: number) => void;
  onImageError?: (eventId: number) => void;
};

function EventMarker({
  event,
  shouldOpenPopup = false,
  showPopup = true,
  onSelect,
  onImageError,
}: Props) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const markerImageUrl = getEventThumbnailUrl(event);
  const eventIcon = useMemo(
    () =>
      new Icon({
        iconUrl: markerImageUrl,
        iconSize: shouldOpenPopup ? [62, 62] : [54, 54],
        iconAnchor: shouldOpenPopup ? [31, 62] : [27, 54],
        popupAnchor: shouldOpenPopup ? [0, -62] : [0, -54],
        className: "event-map-marker",
      }),
    [markerImageUrl, shouldOpenPopup],
  );

  useEffect(() => {
    if (shouldOpenPopup) {
      markerRef.current?.openPopup();
    }
  }, [shouldOpenPopup]);

  const eventHandlers = useMemo(
    () => ({
      click: () => {
        onSelect?.(event.id);
      },
    }),
    [event.id, onSelect],
  );

  return (
    <Marker
      icon={eventIcon}
      eventHandlers={eventHandlers}
      ref={markerRef}
      position={[event.latitude, event.longitude]}
    >
      {showPopup && <EventPopup event={event} onImageError={onImageError} />}
    </Marker>
  );
}

export default memo(EventMarker);
