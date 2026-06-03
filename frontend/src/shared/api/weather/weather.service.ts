import type { WeatherResponse } from "./weather.types";

type FetchWeatherParams = {
  latitude: number;
  longitude: number;
};

export async function fetchWeather({
  latitude,
  longitude,
}: FetchWeatherParams): Promise<WeatherResponse> {
  const searchParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    daily:
      "temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code",
    timezone: "auto",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather request failed");
  }

  return await response.json();
}
