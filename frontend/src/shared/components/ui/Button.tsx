import {
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

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

function getNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(" ");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function isRedActionLabel(children: ReactNode): boolean {
  const label = getNodeText(children)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return ["annuler", "supprimer", "deconnexion"].some((word) =>
    label.includes(word),
  );
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
  const isRedAction = isRedActionLabel(children);
  const buttonClassName = [
    "btn",
    `btn--${variant}`,
    isRedAction ? "btn--red-action" : "",
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
