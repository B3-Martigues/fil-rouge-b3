/**
 * Tableau de bord entreprise.
 * Permet aux comptes valides de creer leurs propres evenements.
 */

import { useState, type FormEvent } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { EVENT_CATEGORIES, type Event } from "../../events/types/category";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import useDataStore from "../../../shared/store/dataStore";
import { useCompanyAccess } from "../hooks/useCompanyAccess";

type CompanyEventForm = {
  title: string;
  description: string;
  date: string;
  address: string;
  latitude: string;
  longitude: string;
  category: Event["category"];
  image: string;
  source: string;
};

type CompanyEventErrors = Partial<Record<keyof CompanyEventForm, string>>;

const emptyEventForm = (): CompanyEventForm => ({
  title: "",
  description: "",
  date: "",
  address: "",
  latitude: "",
  longitude: "",
  category: "culture",
  image: "",
  source: "",
});

const isValidCoordinate = (value: string, min: number, max: number) => {
  const numberValue = Number(value);
  return (
    value.trim() !== "" &&
    !Number.isNaN(numberValue) &&
    numberValue >= min &&
    numberValue <= max
  );
};

const validateEventForm = (form: CompanyEventForm): CompanyEventErrors => {
  const errors: CompanyEventErrors = {};

  if (form.title.trim().length < 3) {
    errors.title = "Le titre doit contenir au moins 3 caracteres";
  }

  if (form.description.trim().length < 10) {
    errors.description = "La description doit contenir au moins 10 caracteres";
  }

  if (!form.date) {
    errors.date = "La date est requise";
  }

  if (form.address.trim().length < 5) {
    errors.address = "L'adresse est requise";
  }

  if (!isValidCoordinate(form.latitude, -90, 90)) {
    errors.latitude = "La latitude doit etre comprise entre -90 et 90";
  }

  if (!isValidCoordinate(form.longitude, -180, 180)) {
    errors.longitude = "La longitude doit etre comprise entre -180 et 180";
  }

  if (form.image && !URL.canParse(form.image)) {
    errors.image = "L'URL de l'image est invalide";
  }

  return errors;
};

export default function CompanyDashboard() {
  const { isPendingApproval } = useCompanyAccess();
  const currentUser = useAuthStore((s) => s.currentUser);
  const addEvent = useDataStore((s) => s.addEvent);
  const [form, setForm] = useState<CompanyEventForm>(emptyEventForm);
  const [errors, setErrors] = useState<CompanyEventErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const updateField = <Key extends keyof CompanyEventForm>(
    field: Key,
    value: CompanyEventForm[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    if (!currentUser) {
      setServerError("Impossible d'identifier l'entreprise connectee");
      return;
    }

    const validationErrors = validateEventForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const newEvent: Event = {
      id: Date.now(),
      company_id: currentUser.id,
      title: form.title.trim(),
      description: form.description.trim(),
      date: new Date(form.date).toISOString(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      address: form.address.trim(),
      category: form.category,
      image: form.image.trim() || undefined,
      source: form.source.trim() || "company",
      created_at: now,
      updated_at: now,
    };

    addEvent(newEvent);
    setForm(emptyEventForm());
    toast.success("Evenement ajoute avec succes");
  };

  if (isPendingApproval) {
    return (
      <div className="company-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre validé par un administrateur avant de pouvoir
          creer des evenements
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Nouvel évènement</h2>
        <p>Ajoutez un evenement public rattache a votre entreprise.</p>
      </section>

      <section className="company-event-form" aria-labelledby="company-event-form-title">

        <form onSubmit={handleSubmit} noValidate>
          <div className="company-event-form__grid">
            <FormField label="Titre" htmlFor="event-title" error={errors.title}>
              <Input
                id="event-title"
                type="text"
                value={form.title}
                hasError={!!errors.title}
                aria-describedby={errors.title ? "event-title-error" : undefined}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </FormField>

            <FormField label="Categorie" htmlFor="event-category">
              <select
                id="event-category"
                className="input"
                value={form.category}
                onChange={(event) =>
                  updateField("category", event.target.value as Event["category"])
                }
              >
                {EVENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="company-event-form__wide">
              <FormField
                label="Description"
                htmlFor="event-description"
                error={errors.description}
              >
                <textarea
                  id="event-description"
                  className={`input ${errors.description ? "input-error" : ""}`}
                  rows={4}
                  value={form.description}
                  aria-describedby={
                    errors.description ? "event-description-error" : undefined
                  }
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Date et heure" htmlFor="event-date" error={errors.date}>
              <Input
                id="event-date"
                type="datetime-local"
                value={form.date}
                hasError={!!errors.date}
                aria-describedby={errors.date ? "event-date-error" : undefined}
                onChange={(event) => updateField("date", event.target.value)}
              />
            </FormField>

            <FormField label="Adresse" htmlFor="event-address" error={errors.address}>
              <Input
                id="event-address"
                type="text"
                autoComplete="street-address"
                value={form.address}
                hasError={!!errors.address}
                aria-describedby={errors.address ? "event-address-error" : undefined}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </FormField>

            <FormField label="Latitude" htmlFor="event-latitude" error={errors.latitude}>
              <Input
                id="event-latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude}
                hasError={!!errors.latitude}
                aria-describedby={errors.latitude ? "event-latitude-error" : undefined}
                onChange={(event) => updateField("latitude", event.target.value)}
              />
            </FormField>

            <FormField label="Longitude" htmlFor="event-longitude" error={errors.longitude}>
              <Input
                id="event-longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.longitude}
                hasError={!!errors.longitude}
                aria-describedby={errors.longitude ? "event-longitude-error" : undefined}
                onChange={(event) => updateField("longitude", event.target.value)}
              />
            </FormField>

            <FormField label="Image" htmlFor="event-image" error={errors.image}>
              <Input
                id="event-image"
                type="url"
                value={form.image}
                hasError={!!errors.image}
                aria-describedby={errors.image ? "event-image-error" : undefined}
                onChange={(event) => updateField("image", event.target.value)}
              />
            </FormField>

            <FormField label="Source" htmlFor="event-source" error={errors.source}>
              <Input
                id="event-source"
                type="text"
                value={form.source}
                hasError={!!errors.source}
                aria-describedby={errors.source ? "event-source-error" : undefined}
                placeholder="company"
                onChange={(event) => updateField("source", event.target.value)}
              />
            </FormField>
          </div>

          {serverError && <ErrorMessage message={serverError} />}

          <Button type="submit">Ajouter l'evenement</Button>
        </form>
      </section>
    </div>
  );
}
