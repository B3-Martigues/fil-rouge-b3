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
  start_date: string;
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
    if (event.latitude == null || event.longitude == null || !event.start_date) {
      queueMicrotask(() => {
        setWeather(null);
        setError(null);
        setLoading(false);
      });
      return;
    }

    const controller = new AbortController();
    let shouldIgnore = false;

    /**Appel météo API */
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setWeather(null);
        const data: WeatherResponse = await fetchWeather({
          latitude: event.latitude,
          longitude: event.longitude,
          signal: controller.signal,
        });

        if (shouldIgnore) return;

        /**Normalisation de la date de l'événement(suppression de l'heure) */
        const normalizedDate = normalizeDate(event.start_date);

        /**Recherche de l'index correspondant au jour de l'événement */
        const index = getWeatherIndex(normalizedDate, data.daily.time);

        /**Extraction des données météo pour ce jour */
        const result = extractWeatherForEvent(data, index);
        setWeather(result);
      } catch {
        if (shouldIgnore) return;

        setError("Erreur lors du chargement de la météo");
        setWeather(null);
      } finally {
        if (!shouldIgnore) {
          setLoading(false);
        }
      }
    };
    fetchData();

    return () => {
      shouldIgnore = true;
      controller.abort();
    };
  }, [event.latitude, event.longitude, event.start_date]);
  return {
    weather,
    loading,
    error,
  };
}
