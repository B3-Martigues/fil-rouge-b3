import type { ChangeEvent } from "react";

import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Input from "../ui/Input";

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
  const canPreview = previewUrl !== "" && URL.canParse(previewUrl);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className={["image-field", className].filter(Boolean).join(" ")}>
      <FormField label={label} htmlFor={id} error={error}>
        <Input
          id={id}
          type="url"
          value={value}
          hasError={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="https://..."
          onChange={(event) => onChange(event.target.value)}
        />
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
        <input
          className="image-field__file"
          id={fileInputId}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        {previewUrl ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onChange("")}
          >
            Supprimer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
