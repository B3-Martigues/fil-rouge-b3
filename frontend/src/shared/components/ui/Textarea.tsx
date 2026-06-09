import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export default function Textarea({ className, hasError, ...props }: Props) {
  const textareaClassName = [
    "input",
    "textarea",
    hasError ? "input--error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <textarea
      {...props}
      aria-invalid={hasError || undefined}
      className={textareaClassName}
    />
  );
}
