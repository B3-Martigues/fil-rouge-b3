import { Heart } from "lucide-react";
import useFavorites from "../../user/hooks/useFavorites";
import type { Event } from "../types/event";

/**Props du composant FavoriteButton */
type Props = {
  event: Event;
};

/**Bouton permettant d'ajouter ou retirer un événement des favoris */
export default function FavoriteButton({ event }: Props) {
  /**Récupération des fonctions du hook favoris */
  const { toggleFavorite, isFavorite } = useFavorites();

  /**Vérifie si l'énévement est déjà en favoris */
  const active = isFavorite(event.id);

  return (
    /**Ajoute ou retire l'événement des favoris */
    <button
      onClick={() => toggleFavorite(event.id)}
      aria-label="favorite event"
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "20px",
      }}
    >
      {/* Icône coeur dynamique selon l'état favoris */}
      <Heart fill={active ? "red" : "none"} color={active ? "red" : "black"} />
    </button>
  );
}
