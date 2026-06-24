import { useMemo } from "react";

import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import { eventsApi } from "../../event/api/events.api";

export default function useFavorites() {
  const { currentUser, isAuthenticated } = useAuthStore();
  const favoriteRows = useDataStore((s) => s.favorites);
  const toggleFavoriteInStore = useDataStore((s) => s.toggleFavorite);
  const upsertFavorite = useDataStore((s) => s.upsertFavorite);

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

  const toggleFavorite = async (eventId: number) => {
    if (!userId) return;

    const active = isFavorite(eventId);
    toggleFavoriteInStore(userId, eventId);

    if (currentUser?.auth_source === "api") {
      if (active) {
        const result = await eventsApi.removeFavorite(eventId);
        if (!result.ok) {
          toggleFavoriteInStore(userId, eventId);
        }
      } else {
        const result = await eventsApi.addFavorite(eventId);
        if (!result.ok) {
          toggleFavoriteInStore(userId, eventId);
          return;
        }
        upsertFavorite(result.data);
      }
    }
  };

  const isFavorite = (eventId: number) => favorites.includes(eventId);

  return {
    favorites,
    favoriteEntries,
    toggleFavorite,
    isFavorite,
  };
}
