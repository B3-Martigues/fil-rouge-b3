import type { WeatherResponse } from "../api/weather/weather.types";
import { Sun, Cloud, CloudRain, CloudLightning } from "lucide-react";

/**Trouve l'index du jour correspondant à la date de l'événement dans les données météo rétournées par l'API */
export function getWeatherIndex(
  eventDate: string,
  weatherTimes: string[],
): number {
  return weatherTimes.findIndex((date) => date === eventDate.split("T")[0]);
}

/**Extrait les données météo correspondant à un événement à partir de l'index trouvé dans les tableaux de l'API */
export function extractWeatherForEvent(
  weather: WeatherResponse,
  index: number,
) {
  if (index === -1) return null;

  return {
    temperature: weather.daily.temperature_2m_max[index],
    precipitation: weather.daily.precipitation_sum[index],
    wind: weather.daily.wind_speed_10m_max[index],
    weatherCode: weather.daily.weather_code[index],
  };
}

/**Normalise une date ISO en supprimant l'heure pour permettre une comparaison avec l'API météo */
export function normalizeDate(date: string): string {
  return date.split("T")[0];
}

/**Retourne une description lisible de la météo à partir du code fourni par l'API Open-Meteo*/
export function getWeatherInfo(code: number) {
  switch (code) {
    case 0:
      return { label: "Ensoleillé", icon: Sun };

    case 2:
      return { label: "Partiellement nuageux", icon: Cloud };

    case 3:
      return { label: "Couvert", icon: Cloud };

    case 65:
      return { label: "Pluie", icon: CloudRain };

    case 95:
      return { label: "Orage", icon: CloudLightning };

    default:
      return { label: "Météo inconnue", icon: Cloud };
  }
}

/**Vérifie si la météo peut être affichée pour un événement donné*/
export function canDisplayWeather(eventDate: string): boolean {
  const today = new Date();
  const event = new Date(eventDate);

  /**Différence en millisecondes*/
  const diff = event.getTime() - today.getTime();

  /**Conversion millisecondes en jours */
  const diffDays = diff / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= 7;
}
