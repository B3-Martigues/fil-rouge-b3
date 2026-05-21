import { Marker } from "react-leaflet";

import type { Event } from "../types/category"
import EventPopup from "./EventPopup";

type Props = {
  event: Event;
};
/**Marker représentant un événement sur la carte */
export default function EventMarker({ event }: Props) {
  return (
    <Marker position={[event.latitude, event.longitude]}>
      <EventPopup event={event} />
    </Marker>
  );
}
