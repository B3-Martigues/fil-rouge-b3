import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  enabled?: boolean;
  onFitDone?: () => void;
  points: Coordinate[];
};

export default function MapFitBounds({
  enabled = true,
  onFitDone,
  points,
}: Props) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 13);
      onFitDone?.();
      return;
    }

    map.fitBounds(
      points.map((point) => [point.latitude, point.longitude]),
      { padding: [32, 32], maxZoom: 13 },
    );
    onFitDone?.();
  }, [enabled, map, onFitDone, points]);

  return null;
}
