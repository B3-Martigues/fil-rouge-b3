import { Heart } from "lucide-react";

import Button from "../../../shared/components/ui/Button";
import useAuthStore from "../../auth/store/authStore";
import useFavorites from "../../user/hooks/useFavorites";
import type { Event } from "../types/event";

type Props = {
  event: Event;
};

export default function FavoriteButton({ event }: Props) {
  const canUseFavorites = useAuthStore(
    (s) =>
      s.isAuthenticated &&
      s.currentUser?.role === "user" &&
      !!s.currentUser.user_id,
  );
  const { toggleFavorite, isFavorite } = useFavorites();

  if (!canUseFavorites) return null;

  const active = isFavorite(event.id);

  return (
    <Button
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`event-favorite-button${active ? " is-active" : ""}`}
      icon={<Heart color="currentColor" fill={active ? "currentColor" : "none"} />}
      iconOnly
      size="icon"
      type="button"
      variant="secondary"
      onClick={() => toggleFavorite(event.id)}
    >
      Favori
    </Button>
  );
}
