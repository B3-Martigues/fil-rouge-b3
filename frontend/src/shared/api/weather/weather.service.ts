import { eventsMock } from "../../../domains/events/mocks/events.mock";
/**Evénement(mock) utilisé pour tester l'integration avec l'API météo */
const event = eventsMock[0];
/**URL de l'API Open-Meteo construite dynamiquement à partir des coordonnées de l'événement */
const url = `https://api.open-meteo.com/v1/forecast?latitude=${event.latitude}&longitude=${event.longitude}&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto`;

/**Fonction permettant de récupérer les données météo */
export async function fetchWeather() {
  const response = await fetch(url);
  return await response.json();
}
