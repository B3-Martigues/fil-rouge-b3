import type { HTMLAttributes } from "react";

type NotificationBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  count: number;
  label?: string;
};

export default function NotificationBadge({
  className,
  count,
  label,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  ...props
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const badgeClassName = ["notification-badge", className]
    .filter(Boolean)
    .join(" ");
  const isAriaHidden = ariaHidden === true || ariaHidden === "true";
  const badgeLabel =
    ariaLabel ??
    label ??
    `${count} notification non lue${count > 1 ? "s" : ""}`;

  return (
    <span
      {...props}
      aria-hidden={ariaHidden}
      aria-label={isAriaHidden ? ariaLabel : badgeLabel}
      className={badgeClassName}
    >
      {count}
    </span>
  );
}
