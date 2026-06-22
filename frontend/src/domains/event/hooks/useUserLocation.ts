import { useEffect, useState } from "react";

export type UserPosition = {
  latitude: number;
  longitude: number;
};

export default function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!navigator.geolocation) {
      const unsupportedTimeoutId = window.setTimeout(() => {
        if (!isMounted) return;

        setError("La geolocalisation n'est pas supportee");
        setLoading(false);
      }, 0);

      return () => {
        isMounted = false;
        window.clearTimeout(unsupportedTimeoutId);
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMounted) return;

        setPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        if (!isMounted) return;

        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  return { position, error, loading };
}
