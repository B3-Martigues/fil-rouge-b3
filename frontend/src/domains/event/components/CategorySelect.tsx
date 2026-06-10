import Checkbox from "../../../shared/components/ui/Checkbox";
import CheckboxGroup from "../../../shared/components/ui/CheckboxGroup";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../types/event-categories";

type CategorySelectProps = {
  error?: string;
  label?: string;
  labelId: string;
  onToggle: (category: EventCategory) => void;
  selected: EventCategory[];
};

export default function CategorySelect({
  error,
  label = "Categories",
  labelId,
  onToggle,
  selected,
}: CategorySelectProps) {
  return (
    <CheckboxGroup error={error} label={label} labelId={labelId}>
      {EVENT_CATEGORIES.map((category) => (
        <Checkbox
          checked={selected.includes(category)}
          key={category}
          label={category}
          onChange={() => onToggle(category)}
        />
      ))}
    </CheckboxGroup>
  );
}
