/**Popup affiché lors du clic sur un événement sur la carte
 * Affiche les informations principales de l'énévement
 */

import { Popup } from "react-leaflet";
import type { Event } from "../types/category";

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
      </div>
    </Popup>
  );
}
