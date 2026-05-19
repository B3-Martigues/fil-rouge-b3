import { Marker } from "react-leaflet";

type Props = {
  latitude: number;
  longitude: number;
};

export default function EventMarker({ latitude, longitude }: Props) {
  return <Marker position={[latitude, longitude]} />;
}
