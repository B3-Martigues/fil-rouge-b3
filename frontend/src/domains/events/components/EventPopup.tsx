import { Popup } from "react-leaflet";

import type { Event } from "../types/event-categories";
import FavoriteButton from "./FavoriteButton";
import ReportEventButton from "./ReportEventButton";
import WeatherBadge from "./WeatherBadge";
import { formatEventDateRange } from "../utils/event";

type Props = {
  event: Event & { latitude: number; longitude: number };
};

const getSourceHref = (source?: string | null) => {
  const value = source?.trim();
  if (!value || /\s/.test(value)) return null;

  if (URL.canParse(value)) return value;

  const sourceWithProtocol = `https://${value}`;
  return URL.canParse(sourceWithProtocol) ? sourceWithProtocol : null;
};

export default function EventPopup({ event }: Props) {
  const sourceLabel = event.source?.trim();
  const sourceHref = getSourceHref(sourceLabel);

  return (
    <Popup>
      <div className="event-popup">
        <img
          src={event.image}
          alt={event.title}
          className="event-popup__image"
        />
        <FavoriteButton event={event} />
        <ReportEventButton event={event} />

        <WeatherBadge
          latitude={event.latitude}
          longitude={event.longitude}
          startDate={event.start_date}
        />

        <h3>{event.title}</h3>
        <p>
          <strong>Debut / fin :</strong> {formatEventDateRange(event)}
        </p>
        <p>
          <strong>Lieu :</strong> {event.address}, {event.city}{" "}
          {event.postal_code}
        </p>
        <p>{event.description}</p>
        {sourceLabel && sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir la source
          </a>
        ) : sourceLabel ? (
          <p>
            <strong>Source :</strong> {sourceLabel}
          </p>
        ) : null}
        <a
          className="btn"
          href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Itineraire
        </a>
      </div>
    </Popup>
  );
}
