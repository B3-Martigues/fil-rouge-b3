import Button from "../ui/Button";
import FormModal from "./FormModal";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export default function ConfirmDialog({
  cancelLabel = "Annuler",
  confirmLabel = "Confirmer",
  message,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  return (
    <FormModal ariaLabel={title} open={open} size="sm" onClose={onCancel}>
      <div className="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
