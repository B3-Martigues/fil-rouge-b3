import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**Props du composant */
type Props = {
  latitude: number;
  longitude: number;
};

/**Recentre automatiquement la carte sur l'utilisateur */
export default function MapAutoCenter({ latitude, longitude }: Props) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], 13);
  }, [latitude, longitude, map]);
  return null;
}
