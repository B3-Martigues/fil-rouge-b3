import type { HTMLAttributes } from "react";

export type StatusBadgeVariant =
  | "active"
  | "danger"
  | "favorite"
  | "info"
  | "neutral"
  | "pending"
  | "success"
  | "suspended"
  | "unread"
  | "warning";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: StatusBadgeVariant;
};

export default function StatusBadge({
  className,
  variant = "neutral",
  ...props
}: Props) {
  const badgeClassName = [
    "status-badge",
    `status-badge--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span {...props} className={badgeClassName} />;
}
