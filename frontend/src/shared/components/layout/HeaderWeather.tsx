import useCurrentWeather from "../../hooks/useCurrentWeather";
import { getWeatherInfo } from "../../utils/weather";

export default function HeaderWeather() {
  const { weather } = useCurrentWeather();

  if (!weather) {
    return null;
  }

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
