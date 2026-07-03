import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  enabled?: boolean;
  maxZoom?: number;
  onFitDone?: () => void;
  padding?: [number, number];
  points: Coordinate[];
  singlePointZoom?: number;
};

const DEFAULT_PADDING: [number, number] = [32, 32];

export default function MapFitBounds({
  enabled = true,
  maxZoom = 13,
  onFitDone,
  padding = DEFAULT_PADDING,
  points,
  singlePointZoom = 13,
}: Props) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    if (points.length === 0) return;

    let hasFinished = false;
    const finish = () => {
      if (hasFinished) return;

      hasFinished = true;
      onFitDone?.();
    };
    const fallbackId = window.setTimeout(finish, 700);

    map.once("moveend", finish);

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], singlePointZoom);
    } else {
      map.fitBounds(
        points.map((point) => [point.latitude, point.longitude]),
        { padding, maxZoom },
      );
    }

    return () => {
      map.off("moveend", finish);
      window.clearTimeout(fallbackId);
    };
  }, [enabled, map, maxZoom, onFitDone, padding, points, singlePointZoom]);

  return null;
}
