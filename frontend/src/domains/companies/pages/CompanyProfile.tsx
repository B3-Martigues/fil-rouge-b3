import { useState, type FormEvent } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { CATEGORIES, type CategoryName } from "../types/company-categories";
import type { Company } from "../types/company";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import useDataStore from "../../../shared/store/dataStore";

type CompanyProfileForm = {
  name: string;
  contact_email: string;
  description: string;
  website: string;
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  postal_code: string;
  logo: string;
  contact_phone_number: string;
  siret: string;
  categories: CategoryName[];
};

type CompanyProfileErrors = Partial<Record<keyof CompanyProfileForm, string>>;

const toForm = (company: Company): CompanyProfileForm => ({
  name: company.name,
  contact_email: company.contact_email,
  description: company.description ?? "",
  website: company.website ?? "",
  latitude: company.latitude?.toString() ?? "",
  longitude: company.longitude?.toString() ?? "",
  address: company.address,
  city: company.city,
  postal_code: company.postal_code,
  logo: company.logo ?? "",
  contact_phone_number: company.contact_phone_number ?? "",
  siret: company.siret ?? "",
  categories: company.category_slugs.filter((category): category is CategoryName =>
    CATEGORIES.includes(category as CategoryName),
  ),
});

const isValidOptionalCoordinate = (value: string, min: number, max: number) => {
  if (value.trim() === "") return true;

  const numberValue = Number(value);
  return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
};

const normalizeComparable = (value: string) => value.trim().toLowerCase();

const validateForm = (form: CompanyProfileForm): CompanyProfileErrors => {
  const errors: CompanyProfileErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = "Le nom de l'entreprise est requis";
  }

  if (!form.contact_email.includes("@")) {
    errors.contact_email = "Email invalide";
  }

  if (form.description.trim().length < 10) {
    errors.description = "La description doit contenir au moins 10 caracteres";
  }

  if (form.website && !URL.canParse(form.website)) {
    errors.website = "URL du site invalide";
  }

  if (form.logo && !URL.canParse(form.logo)) {
    errors.logo = "URL du logo invalide";
  }

  if (!isValidOptionalCoordinate(form.latitude, -90, 90)) {
    errors.latitude = "La latitude doit etre comprise entre -90 et 90";
  }

  if (!isValidOptionalCoordinate(form.longitude, -180, 180)) {
    errors.longitude = "La longitude doit etre comprise entre -180 et 180";
  }

  if (form.address.trim().length < 5) {
    errors.address = "Adresse requise";
  }

  if (form.city.trim().length < 2) {
    errors.city = "Ville requise";
  }

  if (!/^\d{5}$/.test(form.postal_code.trim())) {
    errors.postal_code = "Le code postal doit contenir 5 chiffres";
  }

  if (!/^\d{10}$/.test(form.contact_phone_number)) {
    errors.contact_phone_number = "Le telephone doit contenir 10 chiffres";
  }

  if (!/^\d{14}$/.test(form.siret)) {
    errors.siret = "Le SIRET doit contenir 14 chiffres";
  }

  if (form.categories.length === 0) {
    errors.categories = "Selectionnez au moins une categorie";
  }

  return errors;
};

export default function CompanyProfile() {
  const user = useAuthStore((s) => s.currentUser);
  const login = useAuthStore((s) => s.login);
  const companies = useDataStore((s) => s.companies);
  const updateCompany = useDataStore((s) => s.updateCompany);
  const company = companies.find((item) => item.id === user?.company_id);
  const [form, setForm] = useState<CompanyProfileForm | null>(
    company ? toForm(company) : null,
  );
  const [errors, setErrors] = useState<CompanyProfileErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const updateField = <Key extends keyof CompanyProfileForm>(
    field: Key,
    value: CompanyProfileForm[Key],
  ) => {
    setForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm,
    );
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  };

  const toggleCategory = (category: CategoryName) => {
    if (!form) return;

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

    if (!company || !form || !user) {
      setServerError("Impossible de charger le profil entreprise");
      return;
    }

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const contactEmail = form.contact_email.trim();
    const siret = form.siret.trim();
    const existingContactEmail = companies.find(
      (item) =>
        item.id !== company.id &&
        normalizeComparable(item.contact_email) === normalizeComparable(contactEmail),
    );

    if (existingContactEmail) {
      setServerError("Cet email de contact est deja utilise");
      return;
    }

    const existingSiret = companies.find(
      (item) =>
        item.id !== company.id &&
        normalizeComparable(item.siret ?? "") === normalizeComparable(siret),
    );

    if (existingSiret) {
      setServerError("Ce SIRET est deja utilise");
      return;
    }

    updateCompany(company.id, {
      name: form.name.trim(),
      contact_email: contactEmail,
      description: form.description.trim(),
      website: form.website.trim(),
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      address: form.address.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      logo: form.logo.trim(),
      contact_phone_number: form.contact_phone_number.trim(),
      siret,
      category_slugs: form.categories,
    });

    login({
      ...user,
      username: form.name.trim(),
    });

    toast.success("Profil entreprise mis a jour");
  };

  if (!company || !form) {
    return (
      <div className="company-dashboard">
        <h1>Profil entreprise</h1>
        <ErrorMessage message="Profil entreprise introuvable" />
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Profil entreprise</h2>
        <p>Bienvenue {user?.username}</p>
      </section>

      <section
        className="company-event-form"
        aria-labelledby="company-profile-title"
      >
        <h2 id="company-profile-title">Modifier mes informations</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="company-event-form__grid">
            <FormField
              label="Nom de l'entreprise"
              htmlFor="company-name"
              error={errors.name}
            >
              <Input
                id="company-name"
                type="text"
                value={form.name}
                hasError={!!errors.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </FormField>

            <FormField
              label="Email de contact"
              htmlFor="company-contact-email"
              error={errors.contact_email}
            >
              <Input
                id="company-contact-email"
                type="email"
                value={form.contact_email}
                hasError={!!errors.contact_email}
                onChange={(event) =>
                  updateField("contact_email", event.target.value)
                }
              />
            </FormField>

            <div className="company-event-form__wide">
              <FormField
                label="Description"
                htmlFor="company-description"
                error={errors.description}
              >
                <textarea
                  id="company-description"
                  className={`input ${errors.description ? "input-error" : ""}`}
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </FormField>
            </div>

            <FormField
              label="Site web"
              htmlFor="company-website"
              error={errors.website}
            >
              <Input
                id="company-website"
                type="url"
                value={form.website}
                hasError={!!errors.website}
                onChange={(event) => updateField("website", event.target.value)}
              />
            </FormField>

            <FormField label="Logo" htmlFor="company-logo" error={errors.logo}>
              <Input
                id="company-logo"
                type="url"
                value={form.logo}
                hasError={!!errors.logo}
                onChange={(event) => updateField("logo", event.target.value)}
              />
            </FormField>

            <FormField
              label="Latitude"
              htmlFor="company-latitude"
              error={errors.latitude}
            >
              <Input
                id="company-latitude"
                type="number"
                step="any"
                value={form.latitude}
                hasError={!!errors.latitude}
                onChange={(event) => updateField("latitude", event.target.value)}
              />
            </FormField>

            <FormField
              label="Longitude"
              htmlFor="company-longitude"
              error={errors.longitude}
            >
              <Input
                id="company-longitude"
                type="number"
                step="any"
                value={form.longitude}
                hasError={!!errors.longitude}
                onChange={(event) => updateField("longitude", event.target.value)}
              />
            </FormField>

            <div className="company-event-form__wide">
              <FormField
                label="Adresse"
                htmlFor="company-address"
                error={errors.address}
              >
                <Input
                  id="company-address"
                  type="text"
                  value={form.address}
                  hasError={!!errors.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                />
              </FormField>
            </div>

            <FormField label="Ville" htmlFor="company-city" error={errors.city}>
              <Input
                id="company-city"
                type="text"
                value={form.city}
                hasError={!!errors.city}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </FormField>

            <FormField
              label="Code postal"
              htmlFor="company-postal-code"
              error={errors.postal_code}
            >
              <Input
                id="company-postal-code"
                type="text"
                inputMode="numeric"
                value={form.postal_code}
                hasError={!!errors.postal_code}
                onChange={(event) =>
                  updateField("postal_code", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Telephone"
              htmlFor="company-phone"
              error={errors.contact_phone_number}
            >
              <Input
                id="company-phone"
                type="tel"
                value={form.contact_phone_number}
                hasError={!!errors.contact_phone_number}
                onChange={(event) =>
                  updateField("contact_phone_number", event.target.value)
                }
              />
            </FormField>

            <FormField
              label="SIRET"
              htmlFor="company-siret"
              error={errors.siret}
            >
              <Input
                id="company-siret"
                type="text"
                value={form.siret}
                hasError={!!errors.siret}
                onChange={(event) => updateField("siret", event.target.value)}
              />
            </FormField>

            <fieldset className="company-event-form__wide">
              <legend>Categories</legend>
              <div className="categories-select">
                {CATEGORIES.map((category) => (
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
              {errors.categories && (
                <ErrorMessage message={errors.categories} />
              )}
            </fieldset>
          </div>

          {serverError && <ErrorMessage message={serverError} />}

          <Button type="submit">Enregistrer le profil</Button>
        </form>
      </section>
    </div>
  );
}
