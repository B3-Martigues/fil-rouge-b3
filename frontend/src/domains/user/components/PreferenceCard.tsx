import type { EventCategory } from "../../events/types/event-categories";

type Props = {
  category: EventCategory;
  selected: boolean;
  onClick: () => void;
};

/**Carte cliquable représentant une catégorie de préférence */
export default function PreferenceCard({ category, selected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px",
        border: selected ? "2px solid green" : "1px solid gray",
        cursor: "pointer",
      }}
    >
      {category}
    </div>
  );
}
