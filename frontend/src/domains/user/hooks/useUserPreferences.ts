import { useState } from "react";
import type {
  EventCategory,
  EventCategoryName,
} from "../../events/types/event-categories";

/**Hook pour gérer les préférences utilisateur localement,
 * utilisaé dans onboarding et profil
 */
export function useUserPreferences(initial: EventCategoryName[] = []) {
  const [preferences, setPreferences] = useState<EventCategoryName[]>(initial);

  /**Toggle une catégorie (sélection / désélection)*/
  function toggle(category: EventCategoryName) {
    setPreferences((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }
  return {
    preferences,
    toggle,
    setPreferences,
  };
}
