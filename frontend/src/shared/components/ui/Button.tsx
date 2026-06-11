import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

function ButtonSpinner() {
  return <span className="spinner" aria-hidden="true" />;
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button({
  loading,
  loadingLabel = "Chargement...",
  disabled,
  className,
  children,
  fullWidth = false,
  icon,
  iconOnly = false,
  size = "md",
  variant = "primary",
  ...props
}: Props, ref) {
  const buttonClassName = [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    fullWidth ? "btn--full" : "",
    iconOnly ? "btn--icon-only" : "",
    loading ? "btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      ref={ref}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={buttonClassName}
    >
      {loading ? (
        <span className="btn__content">
          <ButtonSpinner />
          {loadingLabel}
        </span>
      ) : (
        <span className="btn__content">
          {icon && <span className="btn__icon">{icon}</span>}
          {!iconOnly && children}
        </span>
      )}
    </button>
  );
});

export default Button;
