import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

export default function Checkbox({ className, label, ...props }: Props) {
  const checkboxClassName = ["checkbox", className].filter(Boolean).join(" ");

  return (
    <label className={checkboxClassName}>
      <input {...props} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
