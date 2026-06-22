import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import CategorySelect from "../../event/components/CategorySelect";
import useAuthStore from "../../auth/store/authStore";
import type { EventCategory } from "../../event/types/event-categories";
import type { Event } from "../../event/types/event";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import ImageField from "../../../shared/components/forms/ImageField";
import Input from "../../../shared/components/ui/Input";
import Textarea from "../../../shared/components/ui/Textarea";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import useDataStore from "../../../shared/store/dataStore";
import { useOrganizationAccess } from "../hooks/useOrganizationAccess";
import { ROUTES } from "../../../shared/constants/routes";
import {
  emptyEventForm,
  validateEventForm,
  type EventForm,
  type EventFormErrors,
} from "../utils/organizationWorkflow";

export default function OrganizationDashboard() {
  const navigate = useNavigate();
  const { isPendingApproval } = useOrganizationAccess();
  const currentUser = useAuthStore((s) => s.currentUser);
  const addEvent = useDataStore((s) => s.addEvent);
  const [form, setForm] = useState<EventForm>(emptyEventForm);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const updateField = <Key extends keyof EventForm>(
    field: Key,
    value: EventForm[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  };

  const toggleCategory = (category: EventCategory) => {
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

    if (!currentUser?.organization_id) {
      setServerError("Impossible d'identifier l'organisation connectee");
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
      organization_id: currentUser.organization_id,
      title: form.title.trim(),
      description: form.description.trim(),
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      address: form.address.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      category_slugs: form.categories,
      image: form.image.trim(),
      price: Number(form.price.trim()),
      ticketing_link: form.ticketing_link.trim(),
      source: "Evenement cree par une organisation",
      is_active: false,
      created_at: now,
      updated_at: now,
    };

    addEvent(newEvent);
    setForm(emptyEventForm());
    toast.success("Evenement envoye en attente de publication");
    navigate(ROUTES.ORGANIZATION.EVENTS);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 });
    });
  };

  if (isPendingApproval) {
    return (
      <div className="organization-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre valide par un administrateur avant de pouvoir
          creer des événements.
        </p>
      </div>
    );
  }

  return (
    <div className="organization-dashboard">
      <section className="organization-dashboard__header">
        <h2>Nouvel evenement</h2>
        <p>Ajoutez un evenement public rattache a votre organisation.</p>
      </section>

      <section
        className="organization-event-form"
        aria-labelledby="organization-event-form-title"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="organization-event-form__grid">
            <FormField label="Titre" htmlFor="event-title" error={errors.title}>
              <Input
                id="event-title"
                type="text"
                value={form.title}
                hasError={!!errors.title}
                aria-describedby={
                  errors.title ? "event-title-error" : undefined
                }
                onChange={(event) => updateField("title", event.target.value)}
              />
            </FormField>

            <div id="event-categories" className="organization-event-form__wide">
              <CategorySelect
                error={errors.categories}
                labelId="event-categories-label"
                selected={form.categories}
                onToggle={toggleCategory}
              />
            </div>

            <div className="organization-event-form__wide">
              <FormField
                label="Description"
                htmlFor="event-description"
                error={errors.description}
              >
                <Textarea
                  id="event-description"
                  hasError={!!errors.description}
                  rows={4}
                  value={form.description}
                  aria-describedby={
                    errors.description ? "event-description-error" : undefined
                  }
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </FormField>
            </div>

            <FormField
              label="Date de debut"
              htmlFor="event-start-date"
              error={errors.start_date}
            >
              <Input
                id="event-start-date"
                type="datetime-local"
                value={form.start_date}
                hasError={!!errors.start_date}
                aria-describedby={
                  errors.start_date ? "event-start-date-error" : undefined
                }
                onChange={(event) =>
                  updateField("start_date", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Date de fin"
              htmlFor="event-end-date"
              error={errors.end_date}
            >
              <Input
                id="event-end-date"
                type="datetime-local"
                value={form.end_date}
                hasError={!!errors.end_date}
                aria-describedby={
                  errors.end_date ? "event-end-date-error" : undefined
                }
                onChange={(event) =>
                  updateField("end_date", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Adresse"
              htmlFor="event-address"
              error={errors.address}
            >
              <Input
                id="event-address"
                type="text"
                autoComplete="street-address"
                value={form.address}
                hasError={!!errors.address}
                aria-describedby={
                  errors.address ? "event-address-error" : undefined
                }
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
                onChange={(event) =>
                  updateField("postal_code", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Latitude"
              htmlFor="event-latitude"
              error={errors.latitude}
            >
              <Input
                id="event-latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude}
                hasError={!!errors.latitude}
                aria-describedby={
                  errors.latitude ? "event-latitude-error" : undefined
                }
                onChange={(event) =>
                  updateField("latitude", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Longitude"
              htmlFor="event-longitude"
              error={errors.longitude}
            >
              <Input
                id="event-longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.longitude}
                hasError={!!errors.longitude}
                aria-describedby={
                  errors.longitude ? "event-longitude-error" : undefined
                }
                onChange={(event) =>
                  updateField("longitude", event.target.value)
                }
              />
            </FormField>

            <ImageField
              className="organization-event-form__wide"
              id="event-image"
              value={form.image}
              error={errors.image}
              onChange={(value) => updateField("image", value)}
            />

            <FormField label="Prix" htmlFor="event-price" error={errors.price}>
              <Input
                id="event-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                hasError={!!errors.price}
                aria-describedby={errors.price ? "event-price-error" : undefined}
                onChange={(event) => updateField("price", event.target.value)}
              />
            </FormField>

            <FormField
              label="Lien de billetterie"
              htmlFor="event-ticketing-link"
              error={errors.ticketing_link}
            >
              <Input
                id="event-ticketing-link"
                type="url"
                value={form.ticketing_link}
                hasError={!!errors.ticketing_link}
                aria-describedby={
                  errors.ticketing_link ? "event-ticketing-link-error" : undefined
                }
                onChange={(event) =>
                  updateField("ticketing_link", event.target.value)
                }
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
