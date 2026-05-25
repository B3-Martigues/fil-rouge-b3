import { useState, useEffect } from "react";
import useAuthStore from "../../auth/store/authStore";

/**Hook de gestion des événements favoris utilisateur */
export default function useFavorites() {
  /**Récupération des données utilisateur */
  const { currentUser, isAuthenticated } = useAuthStore();

  /**Liste des IDs des événements favoris */
  const [favorites, setFavorites] = useState<number[]>([]);

  /**Clé unique localStorage par utilisateur */
  const storageKey = currentUser ? `favorites_user_${currentUser.id}` : null;

  /**Chargement des favoris depuis localStorage */
  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.role !== "user") {
      setFavorites([]);
      return;
    }
    /**Lecture des favoris sauvegardés */
    const storedFavorites = localStorage.getItem(storageKey!);

    /**Conversion JSON en tableau */
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }
  }, [isAuthenticated, currentUser, storageKey]);

  /**Ajoute ou retire un événement des favoris */
  const toggleFavorite = (eventId: number) => {
    /**Protection utilisateur */
    if (!isAuthenticated || !currentUser || currentUser.role !== "user") {
      return;
    }

    /**Vérifie si l'événement est déjà en favoris */
    const updatedFavorites = favorites.includes(eventId)
      ? favorites.filter((id) => id !== eventId)
      : [...favorites, eventId];

    /**Mise à jour React state */
    setFavorites(updatedFavorites);

    /**Sauvegarde localStorage */
    localStorage.setItem(storageKey!, JSON.stringify(updatedFavorites));
  };

  /**Vérifie si un événement est favoris */
  const isFavorite = (eventId: number) => {
    return favorites.includes(eventId);
  };
  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
}
