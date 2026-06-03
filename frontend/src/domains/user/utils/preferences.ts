import type { EventCategory } from "../../events/types/event-categories";

/**Ajoute ou enlève une catégorie des préférences utilisateur*/
export function togglePreference(
  current: EventCategory[],
  category: EventCategory,
): EventCategory[] {
  return current.includes(category)
    ? current.filter((c) => c !== category)
    : [...current, category];
}
