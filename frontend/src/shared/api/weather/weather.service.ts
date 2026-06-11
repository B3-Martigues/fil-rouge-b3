import type { WeatherResponse } from "./weather.types";

type FetchWeatherParams = {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_WEATHER_TIMEOUT_MS = 8000;

export async function fetchWeather({
  latitude,
  longitude,
  signal,
  timeoutMs = DEFAULT_WEATHER_TIMEOUT_MS,
}: FetchWeatherParams): Promise<WeatherResponse> {
  const searchParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    forecast_days: "8",
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily:
      "temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code",
    timezone: "auto",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`;
  const controller = new AbortController();
  const abortRequest = () => controller.abort(signal?.reason);
  const timeoutId =
    timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  if (signal?.aborted) {
    abortRequest();
  } else {
    signal?.addEventListener("abort", abortRequest, { once: true });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error("Weather request failed");
    }

    return await response.json();
  } finally {
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
    signal?.removeEventListener("abort", abortRequest);
  }
}
