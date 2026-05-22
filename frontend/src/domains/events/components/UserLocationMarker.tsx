import { CircleMarker, Popup } from "react-leaflet";

/**Props du composant UserLocationMarker */
type Props = {
  latitude: number;
  longitude: number;
};

/**Marker représentant la position utilisateur */
export default function UserLocationMarker({ latitude, longitude }: Props) {
  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={10}
      pathOptions={{ color: "red", fillColor: "red", fillOpacity: 0.5 }}
    >
      <Popup>Vous êtes ici</Popup>
    </CircleMarker>
  );
}
