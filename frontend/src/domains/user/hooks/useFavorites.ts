import { useMemo } from "react";

import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

export default function useFavorites() {
  const { currentUser, isAuthenticated } = useAuthStore();
  const favoriteRows = useDataStore((s) => s.favorites);
  const toggleFavoriteInStore = useDataStore((s) => s.toggleFavorite);

  const userId =
    isAuthenticated && currentUser?.role === "user" ? currentUser.user_id : undefined;

  const favoriteEntries = useMemo(
    () =>
      userId
        ? favoriteRows
            .filter((favorite) => favorite.user_id === userId && !favorite.deleted_at)
        : [],
    [favoriteRows, userId],
  );
  const favorites = useMemo(
    () => favoriteEntries.map((favorite) => favorite.event_id),
    [favoriteEntries],
  );

  const toggleFavorite = (eventId: number) => {
    if (!userId) return;

    toggleFavoriteInStore(userId, eventId);
  };

  const isFavorite = (eventId: number) => favorites.includes(eventId);

  return {
    favorites,
    favoriteEntries,
    toggleFavorite,
    isFavorite,
  };
}
