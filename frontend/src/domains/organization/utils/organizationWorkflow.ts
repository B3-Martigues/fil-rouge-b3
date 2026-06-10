import type { StatusBadgeVariant } from "../../../shared/components/ui/StatusBadge";
import type { Event } from "../../event/types/event";
import type { EventCategory } from "../../event/types/event-categories";
import { isEventSuspended, toDateTimeLocalValue } from "../../event/utils/event";
import type { Organization } from "../types/organization";
import {
  CATEGORIES,
  type OrganizationCategoryName,
} from "../types/organization-categories";

export type OrganizerProfileForm = {
  job_role: string;
};

export type OrganizerProfileErrors = Partial<Record<keyof OrganizerProfileForm, string>>;

export type OrganizationForm = {
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
  categories: OrganizationCategoryName[];
};

export type OrganizationFormErrors = Partial<Record<keyof OrganizationForm, string>>;

export type EventForm = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  categories: EventCategory[];
  image: string;
  source: string;
};

export type EventFormErrors = Partial<Record<keyof EventForm, string>>;

export const normalizeComparable = (value: string) => value.trim().toLowerCase();

export const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

export const parseOptionalCoordinate = (value: string) => {
  const trimmedValue = value.trim();

  return trimmedValue ? Number(trimmedValue) : null;
};

export const emptyOrganizerProfileForm = (): OrganizerProfileForm => ({
  job_role: "",
});

export const emptyOrganizationForm = (): OrganizationForm => ({
  name: "",
  contact_email: "",
  description: "",
  website: "",
  latitude: "",
  longitude: "",
  address: "",
  city: "",
  postal_code: "",
  logo: "",
  contact_phone_number: "",
  siret: "",
  categories: ["culture"],
});

export const emptyEventForm = (): EventForm => ({
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  address: "",
  city: "",
  postal_code: "",
  latitude: "",
  longitude: "",
  categories: ["culture"],
  image: "",
  source: "",
});

export const toOrganizationForm = (organization: Organization): OrganizationForm => ({
  name: organization.name,
  contact_email: organization.contact_email,
  description: organization.description ?? "",
  website: organization.website ?? "",
  latitude: organization.latitude?.toString() ?? "",
  longitude: organization.longitude?.toString() ?? "",
  address: organization.address,
  city: organization.city,
  postal_code: organization.postal_code,
  logo: organization.logo ?? "",
  contact_phone_number: organization.contact_phone_number ?? "",
  siret: organization.siret ?? "",
  categories: organization.category_slugs.filter(
    (category): category is OrganizationCategoryName =>
      CATEGORIES.includes(category as OrganizationCategoryName),
  ),
});

export const toEventForm = (event: Event): EventForm => ({
  title: event.title,
  description: event.description,
  start_date: toDateTimeLocalValue(event.start_date),
  end_date: toDateTimeLocalValue(event.end_date),
  address: event.address,
  city: event.city,
  postal_code: event.postal_code,
  latitude: event.latitude?.toString() ?? "",
  longitude: event.longitude?.toString() ?? "",
  categories: event.category_slugs,
  image: event.image,
  source: event.source ?? "",
});

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isValidOptionalUrl = (value: string) => {
  const trimmedValue = value.trim();

  return trimmedValue === "" || URL.canParse(trimmedValue);
};

const isValidOptionalCoordinate = (value: string, min: number, max: number) => {
  if (value.trim() === "") return true;

  const numberValue = Number(value);

  return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
};

export const validateOrganizerProfileForm = (
  form: OrganizerProfileForm,
): OrganizerProfileErrors => {
  const errors: OrganizerProfileErrors = {};

  if (form.job_role.trim().length < 2) {
    errors.job_role = "Indiquez votre fonction d'organisateur";
  }

  return errors;
};

export const validateOrganizationForm = (
  form: OrganizationForm,
  organizations: Organization[],
  currentOrganizationId?: number,
): OrganizationFormErrors => {
  const errors: OrganizationFormErrors = {};
  const contactEmail = form.contact_email.trim();
  const siret = form.siret.trim();

  if (form.name.trim().length < 2) {
    errors.name = "Le nom de l'organisation est requis";
  }

  if (!isValidEmail(contactEmail)) {
    errors.contact_email = "Email de contact invalide";
  }

  if (form.description.trim().length < 10) {
    errors.description = "La description doit contenir au moins 10 caracteres";
  }

  if (!isValidOptionalUrl(form.website)) {
    errors.website = "URL du site invalide";
  }

  if (!isValidOptionalUrl(form.logo)) {
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

  if (
    form.contact_phone_number.trim() &&
    !/^\d{10}$/.test(form.contact_phone_number.trim())
  ) {
    errors.contact_phone_number = "Le telephone doit contenir 10 chiffres";
  }

  if (siret && !/^\d{14}$/.test(siret)) {
    errors.siret = "Le SIRET doit contenir 14 chiffres";
  }

  if (form.categories.length === 0) {
    errors.categories = "Selectionnez au moins une categorie";
  }

  const duplicatedEmail = organizations.some(
    (organization) =>
      organization.id !== currentOrganizationId &&
      !organization.deleted_at &&
      normalizeComparable(organization.contact_email) ===
        normalizeComparable(contactEmail),
  );

  if (duplicatedEmail) {
    errors.contact_email = "Cet email de contact est deja utilise";
  }

  const duplicatedSiret =
    siret !== "" &&
    organizations.some(
      (organization) =>
        organization.id !== currentOrganizationId &&
        !organization.deleted_at &&
        normalizeComparable(organization.siret ?? "") === normalizeComparable(siret),
    );

  if (duplicatedSiret) {
    errors.siret = "Ce SIRET est deja utilise";
  }

  return errors;
};

export const validateEventForm = (form: EventForm): EventFormErrors => {
  const errors: EventFormErrors = {};

  if (form.title.trim().length < 3) {
    errors.title = "Le titre doit contenir au moins 3 caracteres";
  }

  if (form.description.trim().length < 10) {
    errors.description = "La description doit contenir au moins 10 caracteres";
  }

  if (!form.start_date) {
    errors.start_date = "La date de debut est requise";
  }

  if (!form.end_date) {
    errors.end_date = "La date de fin est requise";
  }

  if (
    form.start_date &&
    form.end_date &&
    new Date(form.end_date) < new Date(form.start_date)
  ) {
    errors.end_date = "La date de fin doit etre apres la date de debut";
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

  if (!isValidOptionalCoordinate(form.latitude, -90, 90)) {
    errors.latitude = "La latitude doit etre comprise entre -90 et 90";
  }

  if (!isValidOptionalCoordinate(form.longitude, -180, 180)) {
    errors.longitude = "La longitude doit etre comprise entre -180 et 180";
  }

  if (!form.image.trim()) {
    errors.image = "L'image est requise";
  } else if (!URL.canParse(form.image.trim())) {
    errors.image = "L'URL de l'image est invalide";
  }

  return errors;
};

export const getOrganizationStatus = (organization: Organization) => {
  if (organization.deleted_at) {
    return { label: "Supprimee", variant: "danger" as StatusBadgeVariant };
  }

  if (organization.is_active && organization.is_verified) {
    return { label: "Validee", variant: "active" as StatusBadgeVariant };
  }

  return {
    label: "En attente de validation",
    variant: "pending" as StatusBadgeVariant,
  };
};

export const getManagedEventStatus = (event: Event) => {
  if (event.deleted_at) {
    return { label: "Supprime", variant: "danger" as StatusBadgeVariant };
  }

  if (isEventSuspended(event)) {
    return { label: "Suspendu", variant: "suspended" as StatusBadgeVariant };
  }

  if (event.is_active) {
    return { label: "Valide", variant: "active" as StatusBadgeVariant };
  }

  return {
    label: "En attente de validation",
    variant: "pending" as StatusBadgeVariant,
  };
};
