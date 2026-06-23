import { useState, type ChangeEvent } from "react";

import Button from "../ui/Button";
import FormField from "../ui/FormField";
import {
  getImageUploadError,
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_HELPER_TEXT,
} from "../../utils/imageUpload";

type Props = {
  className?: string;
  error?: string;
  id: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
};

export default function ImageField({
  className,
  error,
  id,
  label = "Image",
  onChange,
  value,
}: Props) {
  const fileInputId = `${id}-upload`;
  const previewUrl = value.trim();
  const canPreview =
    previewUrl !== "" && (URL.canParse(previewUrl) || previewUrl.startsWith("/"));
  const [localError, setLocalError] = useState<string | null>(null);
  const fieldError = localError ?? error;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadError = getImageUploadError(file);
    if (uploadError) {
      setLocalError(uploadError);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        setLocalError(null);
        onChange(reader.result);
      }
    });
    reader.addEventListener("error", () => {
      setLocalError("Impossible de lire cette image.");
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className={["image-field", className].filter(Boolean).join(" ")}>
      <FormField label={label} htmlFor={fileInputId} error={fieldError}>
        <input
          className="image-field__file"
          id={fileInputId}
          type="file"
          accept={IMAGE_UPLOAD_ACCEPT}
          aria-describedby={`${id}-help${fieldError ? ` ${fileInputId}-error` : ""}`}
          onChange={handleFileChange}
        />
        <label className="image-field__dropzone" htmlFor={fileInputId}>
          <span className="image-field__dropzone-title">
            {previewUrl ? "Remplacer l'image" : "Televerser une image"}
          </span>
          <span id={`${id}-help`} className="image-field__help">
            {IMAGE_UPLOAD_HELPER_TEXT}
          </span>
        </label>
      </FormField>

      <div className="image-field__preview">
        {canPreview ? (
          <img src={previewUrl} alt="" loading="lazy" />
        ) : (
          <span>Aucune image selectionnee</span>
        )}
      </div>

      <div className="image-field__actions">
        <label className="btn btn--secondary btn--sm" htmlFor={fileInputId}>
          <span className="btn__content">
            {previewUrl ? "Remplacer" : "Televerser"}
          </span>
        </label>
        {previewUrl ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setLocalError(null);
              onChange("");
            }}
          >
            Supprimer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
