import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  error?: string;
  label: string;
  labelId: string;
  children: ReactNode;
};

export default function CheckboxGroup({
  children,
  className,
  error,
  label,
  labelId,
  ...props
}: Props) {
  const groupClassName = [
    "checkbox-group",
    error ? "checkbox-group--error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...props}
      aria-describedby={error ? `${labelId}-error` : undefined}
      aria-invalid={error ? true : undefined}
      aria-labelledby={labelId}
      className={groupClassName}
      role="group"
    >
      <span className="form-field-label" id={labelId}>
        {label}
      </span>
      <div className="checkbox-group__options">{children}</div>
      {error && (
        <p className="error" id={`${labelId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
