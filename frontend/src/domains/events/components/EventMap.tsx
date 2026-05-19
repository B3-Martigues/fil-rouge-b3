import { MapContainer, TileLayer } from "react-leaflet";

import { eventsMock } from "../mocks/events.mock";
import EventMarker from "./EventMarker";

/**Composant de carte principale basé sur leaflet */
/**Objectif:
 * - Afficher une carte interactive centrée sur une zone donnée
 */
export default function EventMap() {
  return (
    /**Conteneur principal de la carte leaflet
     * il gère le rendu, le zoom, le déplacement et les interactions
     */
    <MapContainer
      center={[43.2965, 5.3698]} // Marseille en phase de développement
      zoom={13} // Niveau de zoom initial
      scrollWheelZoom={true} // Permet le zoom avec la molette
      style={{ height: "500px", width: "100%" }}
    >
      /**TileLayer défini le fond de carte */
      <TileLayer
        attribution="&copy; OpenStreetMap</a> contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      /**Affichage dynamique des événements mockés */
      {eventsMock.map((event) => (
        <EventMarker key={event.id} event={event} />
      ))}
    </MapContainer>
  );
}
