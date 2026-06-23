import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../ui/Button";

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
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => {
      const focusableElement = dialogRef.current?.querySelector<HTMLElement>(
        '.form-modal__body input:not([disabled]), .form-modal__body select:not([disabled]), .form-modal__body textarea:not([disabled]), .form-modal__body button:not([disabled]), .form-modal__body a[href], .form-modal__body [tabindex]:not([tabindex="-1"]), button:not([disabled]), a[href]',
      );

      focusableElement?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [open]);

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
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="form-modal__mobile-bar">
          <strong>{ariaLabel}</strong>
          <span aria-hidden="true" />
        </div>
        <Button
          aria-label="Fermer le formulaire"
          className="form-modal__close"
          icon={<X size={18} aria-hidden="true" />}
          iconOnly
          size="icon"
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Fermer
        </Button>
        <div className="form-modal__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
