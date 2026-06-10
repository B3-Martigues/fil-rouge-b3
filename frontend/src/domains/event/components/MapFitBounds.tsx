import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  points: Coordinate[];
};

export default function MapFitBounds({ points }: Props) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 13);
      return;
    }

    map.fitBounds(
      points.map((point) => [point.latitude, point.longitude]),
      { padding: [32, 32], maxZoom: 13 },
    );
  }, [map, points]);

  return null;
}
