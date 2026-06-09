import type { HTMLAttributes, ReactNode } from "react";

type CardElement = "article" | "div" | "section";

type Props = HTMLAttributes<HTMLElement> & {
  as?: CardElement;
  children: ReactNode;
  interactive?: boolean;
  muted?: boolean;
  selected?: boolean;
};

export default function Card({
  as: Component = "div",
  children,
  className,
  interactive = false,
  muted = false,
  selected = false,
  ...props
}: Props) {
  const cardClassName = [
    "card",
    muted ? "card--muted" : "",
    interactive ? "card--interactive" : "",
    selected ? "card--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component {...props} className={cardClassName}>
      {children}
    </Component>
  );
}
