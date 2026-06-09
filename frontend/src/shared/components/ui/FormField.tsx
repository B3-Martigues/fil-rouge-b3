import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  error?: string;
  htmlFor: string;
  label: string;
};

export default function FormField({
  children,
  className,
  error,
  htmlFor,
  label,
}: Props) {
  const fieldClassName = ["form-field", className].filter(Boolean).join(" ");

  return (
    <div className={fieldClassName}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
