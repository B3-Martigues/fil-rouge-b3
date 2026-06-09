import { Popup } from "react-leaflet";
import { Thermometer, Wind } from "lucide-react";

import type { Event } from "../types/event-categories";
import FavoriteButton from "./FavoriteButton";
import ReportEventButton from "./ReportEventButton";
import { useWeather } from "../../../shared/hooks/useWeather";
import {
  canDisplayWeather,
  getWeatherInfo,
} from "../../../shared/utils/weather";
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
  const { weather, loading, error } = useWeather({
    start_date: event.start_date,
    latitude: event.latitude,
    longitude: event.longitude,
  });
  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;
  const WeatherIcon = weatherInfo?.icon;
  const shouldDisplayWeather = canDisplayWeather(event.start_date);
  const sourceLabel = event.source?.trim();
  const sourceHref = getSourceHref(sourceLabel);

  return (
    <Popup>
      <div className="event-popup">
        <img
          src={event.image}
          alt={event.title}
          style={{ width: "300px", height: "220px" }}
        />
        <FavoriteButton event={event} />
        <ReportEventButton event={event} />

        {shouldDisplayWeather && (
          <div className="event-weather">
            <h3>Meteo</h3>
            {loading && <p>Chargement meteo...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            {!loading && !error && weather && weatherInfo && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <Thermometer size={18} />
                  <span>{weather.temperature} degC</span>
                </div>
                <div>
                  <Wind size={18} />
                  <span>{weather.wind} km/h</span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {WeatherIcon && <WeatherIcon size={20} />}
                  <span>{weatherInfo.label}</span>
                </div>
              </div>
            )}
            {!loading && !error && !weather && !weatherInfo && (
              <p>Aucune donnee meteo disponible</p>
            )}
          </div>
        )}

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
