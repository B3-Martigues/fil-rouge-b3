import { Droplets, Thermometer, Wind } from "lucide-react";

import { useWeather } from "../../../shared/hooks/useWeather";
import {
  canDisplayWeather,
  getWeatherInfo,
} from "../../../shared/utils/weather";

type WeatherBadgeProps = {
  latitude: number;
  longitude: number;
  startDate: string;
};

export default function WeatherBadge({
  latitude,
  longitude,
  startDate,
}: WeatherBadgeProps) {
  const { weather, loading, error } = useWeather({
    start_date: startDate,
    latitude,
    longitude,
  });
  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;
  const WeatherIcon = weatherInfo?.icon;

  if (!canDisplayWeather(startDate)) return null;

  return (
    <div className="event-weather">
      <h3>Meteo</h3>
      {loading && <p>Chargement meteo...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && weather && weatherInfo && (
        <div className="event-weather__metrics">
          <div className="event-weather__metric">
            <Thermometer size={18} aria-hidden="true" />
            <span>{weather.temperature} degC</span>
          </div>
          <div className="event-weather__metric">
            <Wind size={18} aria-hidden="true" />
            <span>{weather.wind} km/h</span>
          </div>
          <div className="event-weather__metric">
            <Droplets size={18} aria-hidden="true" />
            <span>{weather.precipitation} mm</span>
          </div>
          <div className="event-weather__metric">
            {WeatherIcon && <WeatherIcon size={20} aria-hidden="true" />}
            <span>{weatherInfo.label}</span>
          </div>
        </div>
      )}

      {!loading && !error && !weather && !weatherInfo && (
        <p>Aucune donnee meteo disponible</p>
      )}
    </div>
  );
}
