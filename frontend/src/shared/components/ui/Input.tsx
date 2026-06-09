import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export default function Input({ className, hasError, ...props }: Props) {
  const inputClassName = ["input", hasError ? "input--error" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      {...props}
      aria-invalid={hasError || undefined}
      className={inputClassName}
    />
  );
}
