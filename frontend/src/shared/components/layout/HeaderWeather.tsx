import { Cloud } from "lucide-react";

import useCurrentWeather from "../../hooks/useCurrentWeather";
import { getWeatherInfo } from "../../utils/weather";

export default function HeaderWeather() {
  const { weather, loading, error } = useCurrentWeather();

  if (weather) {
    const weatherInfo = getWeatherInfo(weather.weatherCode, weather.wind);
    const WeatherIcon = weatherInfo.icon;
    const roundedTemperature = Math.round(weather.temperature);

    return (
      <span
        className="header-weather"
        title={`${weatherInfo.label}, ${roundedTemperature} degres`}
        aria-label={`${weatherInfo.label}, ${roundedTemperature} degres`}
      >
        <WeatherIcon size={18} aria-hidden="true" />
        <span>{roundedTemperature}°C</span>
      </span>
    );
  }

  return (
    <span
      className="header-weather header-weather--muted"
      title={error ?? "Chargement de la meteo"}
      aria-label={error ?? "Chargement de la meteo"}
    >
      <Cloud size={18} aria-hidden="true" />
      <span>{loading ? "..." : "--°C"}</span>
    </span>
  );
}
