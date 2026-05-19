import { MapContainer, TileLayer } from "react-leaflet";

/**Composant de carte principale basé sur leaflet */
/**Objectif:
 * - Afficher une carte interactive centrée sur une zone donnée
 */
export default function EventMap() {
  return (
    /**Conteneur principal de la carte leaflet
     * il gère le rendu, le zoom
     */
    <MapContainer
      center={[43.2965, 5.3698]} // Marseille en phase de développement
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap</a> contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
