import { Marker } from "react-leaflet";

import type { Event } from "../types/event-categories";
import EventPopup from "./EventPopup";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

type Props = {
  event: Event & { latitude: number; longitude: number };
};

export default function EventMarker({ event }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const recordHistory = useDataStore((s) => s.recordHistory);

  const handleMarkerClick = () => {
    if (currentUser?.role === "user" && currentUser.user_id) {
      recordHistory(currentUser.user_id, event.id);
    }
  };

  return (
    <Marker
      position={[event.latitude, event.longitude]}
      eventHandlers={{ click: handleMarkerClick }}
    >
      <EventPopup event={event} />
    </Marker>
  );
}
