import { useState, useEffect } from "react";
import { fetchWeather } from "../api/weather/weather.service";
import type { WeatherResponse } from "../api/weather/weather.types";
import {
  getWeatherIndex,
  extractWeatherForEvent,
  normalizeDate,
} from "../utils/weather";

/**Hook permettant de récupérer la météo associé à un événement.
 * Il appelle l'API Open-Meteo et transforme les données pour un usage UI
 */
export function useWeather(event: {
  date: string;
  latitude: number;
  longitude: number;
}) {
  /**Données météo finales prêtes pour l'affichage */
  const [weather, setWeather] = useState<null | {
    temperature: number;
    precipitation: number;
    wind: number;
    weatherCode: number;
  }>(null);

  /**Etat de chargement */
  const [loading, setLoading] = useState(false);

  /**Géstion des erreurs */
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event.latitude == null || event.longitude == null || !event.date) {
      setWeather(null);
      return;
    }

    /**Appel météo API */
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data: WeatherResponse = await fetchWeather();

        /**Normalisation de la date de l'événement(suppression de l'heure) */
        const normalizedDate = normalizeDate(event.date);

        /**Recherche de l'index correspondant au jour de l'événement */
        const index = getWeatherIndex(normalizedDate, data.daily.time);

        /**Extraction des données météo pour ce jour */
        const result = extractWeatherForEvent(data, index);
        setWeather(result);
      } catch (err) {
        setError("Erreur lors du chargement de la météo");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [event.latitude, event.longitude, event.date]);
  return {
    weather,
    loading,
    error,
  };
}
