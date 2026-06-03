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
        border: selected ? "2px solid #86d19a" : "1px solid #d6d6d6",
        borderRadius: "8px",
        background: selected ? "#e8f7ed" : "#f5f5f5",
        cursor: "pointer",
      }}
    >
      {category}
    </div>
  );
}
