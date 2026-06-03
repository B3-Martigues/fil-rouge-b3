import { EVENT_CATEGORIES } from "../../events/types/event-categories";
import type { EventCategory } from "../../events/types/event-categories";
import PreferenceCard from "./PreferenceCard";

type Props = {
  selected: EventCategory[];
  toggle: (category: EventCategory) => void;
};

/**Grille de sélection des préférences utilisateur */
export default function PreferencesGrid({ selected, toggle }: Props) {
  return (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      {EVENT_CATEGORIES.map((category) => (
        <PreferenceCard
          key={category}
          category={category}
          selected={selected.includes(category)}
          onClick={() => toggle(category)}
        />
      ))}
    </div>
  );
}
