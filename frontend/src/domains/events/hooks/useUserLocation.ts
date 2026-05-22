import { useState, useEffect } from "react";

/**Type repésentant la location GPS utilisateur */
type UserPosition = {
  latitude: number;
  longitude: number;
};

/**Hook de récupération de la géolocalisation utilisateur */
export default function useUserLocation() {
  /**Position actuelle de l' utilisateur */
  const [position, setPosition] = useState<UserPosition | null>(null);

  /**Erreur éventuelle liée à la géolocalisation */
  const [error, setError] = useState<string | null>(null);

  /**Etat de chargement */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**Vérifie si la géolocalisation est supportée */
    if (!navigator.geolocation) {
      setTimeout(() => {// setTimeout - utilisé pour éviter le warning React
        setError("La géolocalisation n'est pas supportée");
        setLoading(false);
      }, 0);

      return;
    }

    /**Récupération de la géolocalisation utilisateur */
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);
  return { position, error, loading };
}
