import { useState } from "react";
import type { EventCategory } from "../../events/types/event-categories";
import { togglePreference } from "../utils/preferences";

/**Hook pour gérer les préférences utilisateur localement,
 * utilisaé dans onboarding et profil
 */
export function useUserPreferences(initial: EventCategory[] = []) {
  const [preferences, setPreferences] = useState<EventCategory[]>(initial);

  /**Toggle une catégorie (sélection / désélection)*/
  function toggle(category: EventCategory) {
    setPreferences((prev) => togglePreference(prev, category));
  }
  return {
    preferences,
    toggle,
    setPreferences,
  };
}
