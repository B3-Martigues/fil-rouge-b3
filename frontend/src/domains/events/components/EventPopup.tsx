/**Popup affiché lors du clic sur un événement sur la carte
 * Affiche les informations principales de l'énévement
 */

import { Popup } from "react-leaflet";
import type { Event } from "../types/event-categories";
import Button from "../../../shared/components/ui/Button";
import FavoriteButton from "./FavoriteButton";
type Props = {
  event: Event;
};

export default function EventPopup({ event }: Props) {
  return (
    <Popup>
      <div className="event-popup">
        {/* IMAGE EVENT */}
        {event.image && (
          <img
            src={event.image}
            alt={event.title}
            style={{ width: "300px", height: "220px" }}
          />
        )}
        <FavoriteButton event={event} />
        {/**TITRE */}
        <h3>{event.title}</h3>
        {/**DATE */}
        <p>
          <strong>Date :</strong>{" "}
          {new Date(event.date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
        {/**ADRESSE */}
        {event.address && (
          <p>
            <strong>Lieu :</strong> {event.address}
          </p>
        )}
        {/**DESCRIPTION */}
        <p>{event.description}</p>
        {/**SOURCE */}
        {event.source && (
          <a
            href={`https://${event.source}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir la source
          </a>
        )}
        {/**Lien vers Google Maps pour calculer un itinéraire vers l'événement */}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button> Itinéraire</Button>
        </a>
      </div>
    </Popup>
  );
}
