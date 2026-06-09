import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  ariaLabel: string;
  children: ReactNode;
};

export default function Toolbar({
  ariaLabel,
  children,
  className,
  ...props
}: Props) {
  const toolbarClassName = ["toolbar", className].filter(Boolean).join(" ");

  return (
    <div {...props} aria-label={ariaLabel} className={toolbarClassName}>
      {children}
    </div>
  );
}
