import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export default function Select({ className, hasError, ...props }: Props) {
  const selectClassName = [
    "input",
    "select",
    hasError ? "input--error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <select
      {...props}
      aria-invalid={hasError || undefined}
      className={selectClassName}
    />
  );
}
