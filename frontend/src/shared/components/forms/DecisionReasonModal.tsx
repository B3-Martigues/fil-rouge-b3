import type { ReactNode } from "react";

import Button from "../ui/Button";
import Textarea from "../ui/Textarea";
import FormModal from "./FormModal";

type DecisionReasonModalProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
  open: boolean;
  reason: string;
  title: string;
  variant?: "primary" | "secondary" | "danger";
};

export default function DecisionReasonModal({
  cancelLabel = "Annuler",
  children,
  confirmLabel = "Confirmer la decision",
  error,
  onCancel,
  onConfirm,
  onReasonChange,
  open,
  reason,
  title,
  variant = "primary",
}: DecisionReasonModalProps) {
  return (
    <FormModal ariaLabel={title} open={open} size="sm" onClose={onCancel}>
      <div className="confirm-dialog">
        <h2>{title}</h2>
        {children}
        <label className="moderator-reason">
          Raison
          <Textarea
            aria-invalid={!!error}
            required
            rows={4}
            placeholder="Saisissez la justification obligatoire"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="confirm-dialog__actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
