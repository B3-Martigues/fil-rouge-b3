import { useEffect, useState } from "react";

import { fetchWeather } from "../api/weather/weather.service";

type CurrentWeather = {
  temperature: number;
  weatherCode: number;
  wind: number;
};

const GEOLOCATION_TIMEOUT_MS = 7000;

export default function useCurrentWeather() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const failWeather = (message: string) => {
      if (!isMounted) return;

      setError(message);
      setWeather(null);
      setLoading(false);
    };

    if (!navigator.geolocation) {
      failWeather("Geolocalisation indisponible");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isMounted) return;

        try {
          const data = await fetchWeather({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            signal: controller.signal,
          });

          if (!isMounted) return;

          if (!data.current) {
            setError("Meteo indisponible");
            setWeather(null);
            return;
          }

          setWeather({
            temperature: data.current.temperature_2m,
            weatherCode: data.current.weather_code,
            wind: data.current.wind_speed_10m,
          });
          setError(null);
        } catch {
          if (isMounted && !controller.signal.aborted) {
            setError("Meteo indisponible");
            setWeather(null);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      () => {
        failWeather("Position indisponible");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: GEOLOCATION_TIMEOUT_MS,
      },
    );

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return { weather, loading, error };
}
