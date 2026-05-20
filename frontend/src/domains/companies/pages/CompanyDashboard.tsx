/**
 * Tableau de bord entreprise.
 * Permet aux comptes valides de creer leurs propres évènements.
 */

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { EVENT_CATEGORIES, type Event } from "../../events/types/event-categories";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import useDataStore from "../../../shared/store/dataStore";
import { useCompanyAccess } from "../hooks/useCompanyAccess";
import { ROUTES } from "../../../shared/constants/routes";

type CompanyEventForm = {
  title: string;
  description: string;
  date: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  categories: Event["category"][];
  image: string;
};

type CompanyEventErrors = Partial<Record<keyof CompanyEventForm, string>>;

const emptyEventForm = (): CompanyEventForm => ({
  title: "",
  description: "",
  date: "",
  address: "",
  city: "",
  postal_code: "",
  latitude: "",
  longitude: "",
  categories: ["culture"],
  image: "",
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

  if (form.categories.length === 0) {
    errors.categories = "Selectionnez au moins une categorie";
  }

  if (form.address.trim().length < 5) {
    errors.address = "L'adresse est requise";
  }

  if (form.city.trim().length < 2) {
    errors.city = "La ville est requise";
  }

  if (!/^\d{5}$/.test(form.postal_code.trim())) {
    errors.postal_code = "Le code postal doit contenir 5 chiffres";
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
  const navigate = useNavigate();
  const { isPendingApproval } = useCompanyAccess();
  const currentUser = useAuthStore((s) => s.currentUser);
  const addEvent = useDataStore((s) => s.addEvent);
  const [form, setForm] = useState<CompanyEventForm>(emptyEventForm);
  const [errors, setErrors] = useState<CompanyEventErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const imagePreviewUrl = form.image.trim();
  const canPreviewImage = imagePreviewUrl !== "" && URL.canParse(imagePreviewUrl);

  const updateField = <Key extends keyof CompanyEventForm>(
    field: Key,
    value: CompanyEventForm[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  };

  const toggleCategory = (category: Event["category"]) => {
    updateField(
      "categories",
      form.categories.includes(category)
        ? form.categories.filter((item) => item !== category)
        : [...form.categories, category],
    );
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
      city: form.city.trim(),
      postal_code: Number(form.postal_code),
      category: form.categories[0],
      categories: form.categories,
      image: form.image.trim() || undefined,
      source: "Évènement créé par une entreprise",
      is_approved: false,
      created_at: now,
      updated_at: now,
    };

    addEvent(newEvent);
    setForm(emptyEventForm());
    toast.success("Évènement envoyé en attente de validation");
    navigate(ROUTES.COMPANY.EVENTS);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
    });
  };

  if (isPendingApproval) {
    return (
      <div className="company-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre validé par un administrateur avant de pouvoir
          creer des évènements
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Nouvel évènement</h2>
        <p>Ajoutez un évènement public rattache a votre entreprise.</p>
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

            <div id="event-categories" className="company-event-form__wide">
              <span className="form-field-label">Categories</span>
              <div className="categories-select">
                {EVENT_CATEGORIES.map((category) => (
                  <label className="categories-select__option" key={category}>
                    <input
                      type="checkbox"
                      checked={form.categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
              {errors.categories && <ErrorMessage message={errors.categories} />}
            </div>

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

            <FormField label="Ville" htmlFor="event-city" error={errors.city}>
              <Input
                id="event-city"
                type="text"
                autoComplete="address-level2"
                value={form.city}
                hasError={!!errors.city}
                aria-describedby={errors.city ? "event-city-error" : undefined}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </FormField>

            <FormField
              label="Code postal"
              htmlFor="event-postal-code"
              error={errors.postal_code}
            >
              <Input
                id="event-postal-code"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                value={form.postal_code}
                hasError={!!errors.postal_code}
                aria-describedby={
                  errors.postal_code ? "event-postal-code-error" : undefined
                }
                onChange={(event) => updateField("postal_code", event.target.value)}
              />
            </FormField>

            <FormField label="Latitude" htmlFor="event-latitude" error={errors.latitude}>
              <Input
                id="event-latitude"
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
                step="any"
                min="-180"
                max="180"
                value={form.longitude}
                hasError={!!errors.longitude}
                aria-describedby={errors.longitude ? "event-longitude-error" : undefined}
                onChange={(event) => updateField("longitude", event.target.value)}
              />
            </FormField>

            <div className="company-event-form__wide company-event-form__image-field">
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

              <div className="company-event-form__image-preview">
              <span>Aperçu de l'image</span>
                {canPreviewImage && (
                  <img src={imagePreviewUrl} alt="" loading="lazy" />
                )}
              </div>
            </div>
          </div>

          {serverError && <ErrorMessage message={serverError} />}

          <Button type="submit">Ajouter l'évènement</Button>
        </form>
      </section>
    </div>
  );
}
