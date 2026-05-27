/**Popup affiché lors du clic sur un événement sur la carte
 * Affiche les informations principales de l'énévement
 */

import { Popup } from "react-leaflet";
import type { Event } from "../types/event-categories";
import Button from "../../../shared/components/ui/Button";
import FavoriteButton from "./FavoriteButton";
import { useWeather } from "../../../shared/hooks/useWeather";
import { getWeatherInfo } from "../../../shared/utils/weather";
import { Thermometer, Wind } from "lucide-react";
type Props = {
  event: Event;
};

export default function EventPopup({ event }: Props) {
  const { weather, loading, error } = useWeather({
    date: event.date,
    latitude: event.latitude,
    longitude: event.longitude,
  });
  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;
  const WeatherIcon = weatherInfo?.icon;
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
        {/**WEATHER */}
        <div className="event-weather">
          <h3>Météo</h3>
          {loading && <p>Chargement meteo...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {!loading && !error && weather && weatherInfo && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <Thermometer size={18} />{" "}
                <span>{weather.temperature}°C</span>{" "}
              </div>
              <div>
                <Wind size={18} />
                <span>{weather.wind}km/h</span>{" "}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {WeatherIcon && <WeatherIcon size={20} />}{" "}
                <span>{weatherInfo.label}</span>
              </div>
            </div>
          )}
          {!loading && !error && !weather && !weatherInfo && (
            <p>Aucune donnée météo disponible</p>
          )}
        </div>
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
