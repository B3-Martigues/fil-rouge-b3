import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type FormModalSize = "sm" | "md" | "lg" | "wide";

type FormModalProps = {
  ariaLabel: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  size?: FormModalSize;
};

export default function FormModal({
  ariaLabel,
  children,
  open,
  onClose,
  size = "md",
}: FormModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="form-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        className={`form-modal__dialog form-modal__dialog--${size}`}
        role="dialog"
      >
        <button
          aria-label="Fermer le formulaire"
          className="form-modal__close"
          type="button"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="form-modal__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
