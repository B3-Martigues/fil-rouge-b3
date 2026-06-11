import type { WeatherResponse } from "../api/weather/weather.types";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  Wind,
} from "lucide-react";

/** Trouve l'index du jour correspondant a la date de l'evenement. */
export function getWeatherIndex(
  eventDate: string,
  weatherTimes: string[],
): number {
  return weatherTimes.findIndex((date) => date === normalizeDate(eventDate));
}

/** Extrait les donnees meteo correspondant a un evenement. */
export function extractWeatherForEvent(
  weather: WeatherResponse,
  index: number,
) {
  if (
    index < 0 ||
    weather.daily.temperature_2m_max[index] == null ||
    weather.daily.precipitation_sum[index] == null ||
    weather.daily.wind_speed_10m_max[index] == null ||
    weather.daily.weather_code[index] == null
  ) {
    return null;
  }

  return {
    temperature: weather.daily.temperature_2m_max[index],
    precipitation: weather.daily.precipitation_sum[index],
    wind: weather.daily.wind_speed_10m_max[index],
    weatherCode: weather.daily.weather_code[index],
  };
}

/** Normalise une date ISO en supprimant l'heure. */
export function normalizeDate(date: string): string {
  return date.split("T")[0];
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Retourne une description lisible de la meteo Open-Meteo. */
export function getWeatherInfo(code: number, windSpeed?: number) {
  if (windSpeed != null && windSpeed >= 40) {
    return { label: "Venteux", icon: Wind };
  }

  switch (code) {
    case 0:
      return { label: "Ensoleillé", icon: Sun };

    case 1:
    case 2:
      return { label: "Partiellement nuageux", icon: Cloud };

    case 3:
      return { label: "Couvert", icon: Cloud };

    case 45:
    case 48:
      return { label: "Brouillard", icon: CloudFog };

    case 51:
    case 53:
    case 55:
      return { label: "Bruine", icon: CloudDrizzle };

    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return { label: "Pluie", icon: CloudRain };

    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { label: "Neige", icon: CloudSnow };

    case 95:
    case 96:
    case 99:
      return { label: "Orage", icon: CloudLightning };

    default:
      return { label: "Météo inconnue", icon: Cloud };
  }
}

/** Verifie si la meteo peut etre affichee pour un evenement donne. */
export function canDisplayWeather(eventDate: string): boolean {
  const event = new Date(eventDate);
  if (Number.isNaN(event.getTime())) return false;

  const today = toStartOfDay(new Date());
  const eventDay = toStartOfDay(event);
  const diffDays = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  return diffDays >= 0 && diffDays <= 7;
}
