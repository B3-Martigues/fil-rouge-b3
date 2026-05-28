import { useState } from "react";
import type { EventCategory } from "../../events/types/event-categories";

/**Hook pour gérer les préférences utilisateur localement,
 * utilisaé dans onboarding et profil
 */

export function useUserPreferences(initial: EventCategory[] = []) {
  const [preferences, setPreferences] = useState<EventCategory[]>(initial);

  /**Toggle une catégorie (selection / désélection)*/
  function toggle(category: EventCategory) {
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
