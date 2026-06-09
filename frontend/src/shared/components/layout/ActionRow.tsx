import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end" | "between";
};

export default function ActionRow({
  align = "start",
  className,
  ...props
}: Props) {
  const actionRowClassName = [
    "action-row",
    `action-row--${align}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div {...props} className={actionRowClassName} />;
}
