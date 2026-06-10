import { useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";

import CategorySelect from "../../events/components/CategorySelect";
import {
  CATEGORIES,
  type CategoryName,
} from "../../organizations/types/organization-categories";
import type { Organization } from "../../organizations/types/organization";
import type { Event } from "../../events/types/event";
import type { EventCategory } from "../../events/types/event-categories";
import {
  formatDateTime,
  formatEventDateRange,
  isEventSuspended,
  toDateTimeLocalValue,
} from "../../events/utils/event";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import ActionRow from "../../../shared/components/layout/ActionRow";
import ConfirmDialog from "../../../shared/components/forms/ConfirmDialog";
import EmptyState from "../../../shared/components/feedback/EmptyState";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import FormModal from "../../../shared/components/forms/FormModal";
import Button from "../../../shared/components/ui/Button";
import Checkbox from "../../../shared/components/ui/Checkbox";
import CheckboxGroup from "../../../shared/components/ui/CheckboxGroup";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import StatusBadge from "../../../shared/components/ui/StatusBadge";
import Textarea from "../../../shared/components/ui/Textarea";

type OrganizationForm = {
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

type OrganizationFormErrors = Partial<Record<keyof OrganizationForm, string>>;

type EventForm = {
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

type EventFormErrors = Partial<Record<keyof EventForm, string>>;

type UserOrganization = {
  organization: Organization;
  memberRole: string;
};

const normalizeComparable = (value: string) => value.trim().toLowerCase();

const toOrganizationForm = (organization: Organization): OrganizationForm => ({
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
  categories: organization.category_slugs.filter((category): category is CategoryName =>
    CATEGORIES.includes(category as CategoryName),
  ),
});

const toEventForm = (event: Event): EventForm => ({
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

const emptyEventForm = (): EventForm => ({
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

const isValidOptionalCoordinate = (value: string, min: number, max: number) => {
  if (value.trim() === "") return true;

  const numberValue = Number(value);
  return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
};

const parseOptionalCoordinate = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue ? Number(trimmedValue) : null;
};

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const validateOrganizationForm = (
  form: OrganizationForm,
  organizations: Organization[],
  organizationId: number,
): OrganizationFormErrors => {
  const errors: OrganizationFormErrors = {};
  const contactEmail = form.contact_email.trim();
  const siret = form.siret.trim();

  if (form.name.trim().length < 2) {
    errors.name = "Le nom de l'organization est requis";
  }

  if (!contactEmail.includes("@")) {
    errors.contact_email = "Email invalide";
  }

  if (form.description.trim().length < 10) {
    errors.description = "La description doit contenir au moins 10 caracteres";
  }

  if (form.website.trim() && !URL.canParse(form.website.trim())) {
    errors.website = "URL du site invalide";
  }

  if (form.logo.trim() && !URL.canParse(form.logo.trim())) {
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

  if (!/^\d{10}$/.test(form.contact_phone_number.trim())) {
    errors.contact_phone_number = "Le telephone doit contenir 10 chiffres";
  }

  if (!/^\d{14}$/.test(siret)) {
    errors.siret = "Le SIRET doit contenir 14 chiffres";
  }

  if (form.categories.length === 0) {
    errors.categories = "Selectionnez au moins une categorie";
  }

  const duplicatedEmail = organizations.some(
    (organization) =>
      organization.id !== organizationId &&
      !organization.deleted_at &&
      normalizeComparable(organization.contact_email) ===
        normalizeComparable(contactEmail),
  );

  if (duplicatedEmail) {
    errors.contact_email = "Cet email de contact est deja utilise";
  }

  const duplicatedSiret = organizations.some(
    (organization) =>
      organization.id !== organizationId &&
      !organization.deleted_at &&
      normalizeComparable(organization.siret ?? "") === normalizeComparable(siret),
  );

  if (duplicatedSiret) {
    errors.siret = "Ce SIRET est deja utilise";
  }

  return errors;
};

const validateEventForm = (form: EventForm): EventFormErrors => {
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

const getEventStatus = (event: Event) => {
  if (isEventSuspended(event)) {
    return { label: "Suspendu", variant: "suspended" as const };
  }

  return event.is_active
    ? { label: "Publie", variant: "active" as const }
    : { label: "En attente", variant: "pending" as const };
};

export default function UserOrganizations() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const organizers = useDataStore((s) => s.organizers);
  const allOrganizations = useDataStore((s) => s.organizations);
  const events = useDataStore((s) => s.events);
  const updateOrganization = useDataStore((s) => s.updateOrganization);
  const addEvent = useDataStore((s) => s.addEvent);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const deleteEvent = useDataStore((s) => s.deleteEvent);
  const [editingOrganizationId, setEditingOrganizationId] = useState<number | null>(null);
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm | null>(null);
  const [organizationErrors, setOrganizationErrors] = useState<OrganizationFormErrors>({});
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventOrganizationId, setEventOrganizationId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState<EventForm | null>(null);
  const [eventErrors, setEventErrors] = useState<EventFormErrors>({});
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<number | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const currentUserId = currentUser?.user_id;

  const userOrganizations = useMemo<UserOrganization[]>(() => {
    if (!currentUserId) return [];

    return organizers
      .filter(
        (member) =>
          member.user_id === currentUserId && !member.deleted_at,
      )
      .map((member) => {
        const organization = allOrganizations.find(
          (item) => item.id === member.organization_id && !item.deleted_at,
        );

        if (!organization) return null;

        return {
          organization,
          memberRole: member.job_role ?? "Membre",
        };
      })
      .filter((item): item is UserOrganization => item !== null);
  }, [allOrganizations, organizers, currentUserId]);

  const userOrganizationIds = useMemo(
    () => new Set(userOrganizations.map(({ organization }) => organization.id)),
    [userOrganizations],
  );

  const eventsByOrganizationId = useMemo(() => {
    const groupedEvents = new Map<number, Event[]>();

    events
      .filter(
        (event) =>
          userOrganizationIds.has(event.organization_id) && !event.deleted_at,
      )
      .toSorted(
        (firstEvent, secondEvent) =>
          new Date(secondEvent.created_at ?? secondEvent.start_date).getTime() -
          new Date(firstEvent.created_at ?? firstEvent.start_date).getTime(),
      )
      .forEach((event) => {
        const organizationEvents = groupedEvents.get(event.organization_id) ?? [];
        groupedEvents.set(event.organization_id, [...organizationEvents, event]);
      });

    return groupedEvents;
  }, [events, userOrganizationIds]);

  if (userOrganizations.length === 0) return null;

  const closeOrganizationModal = () => {
    setEditingOrganizationId(null);
    setOrganizationForm(null);
    setOrganizationErrors({});
    setModalError(null);
  };

  const closeEventModal = () => {
    setEditingEventId(null);
    setEventOrganizationId(null);
    setEventForm(null);
    setEventErrors({});
    setModalError(null);
  };

  const startOrganizationEdit = (organization: Organization) => {
    setEditingOrganizationId(organization.id);
    setOrganizationForm(toOrganizationForm(organization));
    setOrganizationErrors({});
    setModalError(null);
  };

  const startEventCreate = (organizationId: number) => {
    setEditingEventId(null);
    setEventOrganizationId(organizationId);
    setEventForm(emptyEventForm());
    setEventErrors({});
    setModalError(null);
  };

  const startEventEdit = (event: Event) => {
    setEditingEventId(event.id);
    setEventOrganizationId(event.organization_id);
    setEventForm(toEventForm(event));
    setEventErrors({});
    setModalError(null);
  };

  const updateOrganizationField = <Key extends keyof OrganizationForm>(
    field: Key,
    value: OrganizationForm[Key],
  ) => {
    setOrganizationForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm,
    );
    setOrganizationErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  };

  const updateEventField = <Key extends keyof EventForm>(
    field: Key,
    value: EventForm[Key],
  ) => {
    setEventForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm,
    );
    setEventErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  };

  const toggleOrganizationCategory = (category: CategoryName) => {
    if (!organizationForm) return;

    updateOrganizationField(
      "categories",
      organizationForm.categories.includes(category)
        ? organizationForm.categories.filter((item) => item !== category)
        : [...organizationForm.categories, category],
    );
  };

  const toggleEventCategory = (category: EventCategory) => {
    if (!eventForm) return;

    updateEventField(
      "categories",
      eventForm.categories.includes(category)
        ? eventForm.categories.filter((item) => item !== category)
        : [...eventForm.categories, category],
    );
  };

  const saveOrganization = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (!organizationForm || editingOrganizationId === null) return;

    const errors = validateOrganizationForm(
      organizationForm,
      allOrganizations,
      editingOrganizationId,
    );
    setOrganizationErrors(errors);
    setModalError(null);

    if (Object.keys(errors).length > 0) return;

    updateOrganization(editingOrganizationId, {
      name: organizationForm.name.trim(),
      contact_email: organizationForm.contact_email.trim(),
      description: organizationForm.description.trim(),
      website: organizationForm.website.trim(),
      latitude: parseOptionalCoordinate(organizationForm.latitude),
      longitude: parseOptionalCoordinate(organizationForm.longitude),
      address: organizationForm.address.trim(),
      city: organizationForm.city.trim(),
      postal_code: organizationForm.postal_code.trim(),
      logo: organizationForm.logo.trim(),
      contact_phone_number: organizationForm.contact_phone_number.trim(),
      siret: organizationForm.siret.trim(),
      category_slugs: organizationForm.categories,
    });

    closeOrganizationModal();
    toast.success("Organization mise a jour");
  };

  const saveEvent = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (!eventForm || eventOrganizationId === null) return;

    const organization = allOrganizations.find(
      (item) => item.id === eventOrganizationId && !item.deleted_at,
    );

    if (!organization) {
      setModalError("Organization introuvable");
      return;
    }

    if (!organization.is_active) {
      setModalError("Cette organization doit etre active pour gerer ses evenements");
      return;
    }

    const errors = validateEventForm(eventForm);
    setEventErrors(errors);
    setModalError(null);

    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    const eventPayload = {
      organization_id: eventOrganizationId,
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      start_date: new Date(eventForm.start_date).toISOString(),
      end_date: new Date(eventForm.end_date).toISOString(),
      latitude: parseOptionalCoordinate(eventForm.latitude),
      longitude: parseOptionalCoordinate(eventForm.longitude),
      address: eventForm.address.trim(),
      city: eventForm.city.trim(),
      postal_code: eventForm.postal_code.trim(),
      category_slugs: eventForm.categories,
      image: eventForm.image.trim(),
      source: eventForm.source.trim() || "Evenement cree par une organization",
      is_active: false,
    };

    if (editingEventId === null) {
      addEvent({
        id: createNextId(events),
        ...eventPayload,
        created_at: now,
        updated_at: now,
      });
      toast.success("Evenement envoye en attente de publication");
    } else {
      updateEvent(editingEventId, eventPayload);
      toast.success("Evenement mis a jour, en attente de publication");
    }

    closeEventModal();
  };

  const confirmDeleteEvent = () => {
    if (pendingDeleteEventId === null) return;

    const deletedEvent = events.find((event) => event.id === pendingDeleteEventId);

    deleteEvent(pendingDeleteEventId);
    setPendingDeleteEventId(null);
    closeEventModal();
    toast.success(`${deletedEvent?.title ?? "Evenement"} supprime`);
  };

  const pendingDeleteEvent = events.find(
    (event) => event.id === pendingDeleteEventId,
  );

  return (
    <section className="user-organizations" aria-labelledby="user-orgs-title">
      <ConfirmDialog
        confirmLabel="Supprimer"
        message={
          pendingDeleteEvent
            ? `Supprimer l'evenement "${pendingDeleteEvent.title}" ?`
            : "Supprimer cet evenement ?"
        }
        open={pendingDeleteEventId !== null}
        title="Supprimer l'evenement"
        onCancel={() => setPendingDeleteEventId(null)}
        onConfirm={confirmDeleteEvent}
      />

      <FormModal
        ariaLabel="Modifier une organization"
        open={organizationForm !== null && editingOrganizationId !== null}
        size="lg"
        onClose={closeOrganizationModal}
      >
        {organizationForm && (
          <OrganizationEditor
            errors={organizationErrors}
            form={organizationForm}
            modalError={modalError}
            onCategoryToggle={toggleOrganizationCategory}
            onCancel={closeOrganizationModal}
            onFieldChange={updateOrganizationField}
            onSubmit={saveOrganization}
          />
        )}
      </FormModal>

      <FormModal
        ariaLabel={
          editingEventId === null ? "Ajouter un evenement" : "Modifier un evenement"
        }
        open={eventForm !== null && eventOrganizationId !== null}
        size="lg"
        onClose={closeEventModal}
      >
        {eventForm && (
          <EventEditor
            errors={eventErrors}
            form={eventForm}
            modalError={modalError}
            title={
              editingEventId === null
                ? "Ajouter un evenement"
                : "Modifier un evenement"
            }
            onCancel={closeEventModal}
            onCategoryToggle={toggleEventCategory}
            onFieldChange={updateEventField}
            onSubmit={saveEvent}
          />
        )}
      </FormModal>

      <div className="user-organizations__header">
        <div>
          <h2 id="user-orgs-title">Mes organizations</h2>
          <p>
            Gere les informations et les evenements des organizations auxquelles
            ton compte est rattache.
          </p>
        </div>
        <span className="admin-count">{userOrganizations.length}</span>
      </div>

      <div className="user-organizations__list">
        {userOrganizations.map(({ organization, memberRole }) => {
          const organizationEvents = eventsByOrganizationId.get(organization.id) ?? [];
          const canManageEvents = organization.is_active && organization.is_verified;

          return (
            <article className="user-organization" key={organization.id}>
              <div className="user-organization__summary">
                {organization.logo && (
                  <img src={organization.logo} alt={`Logo ${organization.name}`} />
                )}
                <div>
                  <div className="user-organization__title">
                    <h3>{organization.name}</h3>
                    <StatusBadge
                      variant={organization.is_active ? "active" : "pending"}
                    >
                      {organization.is_active ? "Active" : "En attente"}
                    </StatusBadge>
                  </div>
                  <p>{organization.description}</p>
                  <dl>
                    <div>
                      <dt>Role</dt>
                      <dd>{memberRole}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{organization.contact_email}</dd>
                    </div>
                    <div>
                      <dt>Adresse</dt>
                      <dd>
                        {organization.address}, {organization.city} {organization.postal_code}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <ActionRow className="user-organization__actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => startOrganizationEdit(organization)}
                >
                  Modifier l'organization
                </Button>
                <Button
                  disabled={!canManageEvents}
                  type="button"
                  onClick={() => startEventCreate(organization.id)}
                >
                  Ajouter un evenement
                </Button>
              </ActionRow>

              {!canManageEvents && (
                <p className="user-organization__notice">
                  L'organization doit etre validee et active pour publier des
                  evenements.
                </p>
              )}

              <div className="user-organization__events">
                <div className="user-organization__events-title">
                  <h4>Evenements</h4>
                  <span className="admin-count">{organizationEvents.length}</span>
                </div>

                {organizationEvents.length === 0 ? (
                  <EmptyState message="Aucun evenement rattache a cette organization." />
                ) : (
                  <div className="user-organization-event-list">
                    {organizationEvents.map((event) => {
                      const eventStatus = getEventStatus(event);

                      return (
                        <article className="user-organization-event" key={event.id}>
                          <img src={event.image} alt="" loading="lazy" />
                          <div>
                            <div className="user-organization-event__header">
                              <h5>{event.title}</h5>
                              <StatusBadge variant={eventStatus.variant}>
                                {eventStatus.label}
                              </StatusBadge>
                            </div>
                            <p>{event.description}</p>
                            <dl>
                              <div>
                                <dt>Dates</dt>
                                <dd>{formatEventDateRange(event)}</dd>
                              </div>
                              <div>
                                <dt>Lieu</dt>
                                <dd>
                                  {event.address}, {event.city}{" "}
                                  {event.postal_code}
                                </dd>
                              </div>
                              <div>
                                <dt>Creation</dt>
                                <dd>
                                  {event.created_at
                                    ? formatDateTime(event.created_at)
                                    : "Non renseignee"}
                                </dd>
                              </div>
                            </dl>
                            <ActionRow className="admin-actions">
                              <Button
                                disabled={!canManageEvents}
                                variant="secondary"
                                type="button"
                                onClick={() => startEventEdit(event)}
                              >
                                Modifier
                              </Button>
                              <Button
                                disabled={!canManageEvents}
                                variant="danger"
                                type="button"
                                onClick={() => setPendingDeleteEventId(event.id)}
                              >
                                Supprimer
                              </Button>
                            </ActionRow>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OrganizationEditor({
  errors,
  form,
  modalError,
  onCancel,
  onCategoryToggle,
  onFieldChange,
  onSubmit,
}: {
  errors: OrganizationFormErrors;
  form: OrganizationForm;
  modalError: string | null;
  onCancel: () => void;
  onCategoryToggle: (category: CategoryName) => void;
  onFieldChange: <Key extends keyof OrganizationForm>(
    field: Key,
    value: OrganizationForm[Key],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="admin-create-account" onSubmit={onSubmit} noValidate>
      <h2>Modifier l'organization</h2>
      <div className="admin-form-grid">
        <FormField label="Nom" htmlFor="member-organization-name" error={errors.name}>
          <Input
            id="member-organization-name"
            value={form.name}
            hasError={!!errors.name}
            onChange={(event) => onFieldChange("name", event.target.value)}
          />
        </FormField>
        <FormField
          label="Email de contact"
          htmlFor="member-organization-email"
          error={errors.contact_email}
        >
          <Input
            id="member-organization-email"
            type="email"
            value={form.contact_email}
            hasError={!!errors.contact_email}
            onChange={(event) =>
              onFieldChange("contact_email", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Description"
          htmlFor="member-organization-description"
          className="admin-form-grid__wide"
          error={errors.description}
        >
          <Textarea
            id="member-organization-description"
            rows={4}
            value={form.description}
            hasError={!!errors.description}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Site web"
          htmlFor="member-organization-website"
          error={errors.website}
        >
          <Input
            id="member-organization-website"
            type="url"
            value={form.website}
            hasError={!!errors.website}
            onChange={(event) => onFieldChange("website", event.target.value)}
          />
        </FormField>
        <FormField label="Logo" htmlFor="member-organization-logo" error={errors.logo}>
          <Input
            id="member-organization-logo"
            type="url"
            value={form.logo}
            hasError={!!errors.logo}
            onChange={(event) => onFieldChange("logo", event.target.value)}
          />
        </FormField>
        <FormField
          label="Adresse"
          htmlFor="member-organization-address"
          className="admin-form-grid__wide"
          error={errors.address}
        >
          <Input
            id="member-organization-address"
            value={form.address}
            hasError={!!errors.address}
            onChange={(event) => onFieldChange("address", event.target.value)}
          />
        </FormField>
        <FormField label="Ville" htmlFor="member-organization-city" error={errors.city}>
          <Input
            id="member-organization-city"
            value={form.city}
            hasError={!!errors.city}
            onChange={(event) => onFieldChange("city", event.target.value)}
          />
        </FormField>
        <FormField
          label="Code postal"
          htmlFor="member-organization-postal-code"
          error={errors.postal_code}
        >
          <Input
            id="member-organization-postal-code"
            inputMode="numeric"
            value={form.postal_code}
            hasError={!!errors.postal_code}
            onChange={(event) =>
              onFieldChange("postal_code", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Telephone"
          htmlFor="member-organization-phone"
          error={errors.contact_phone_number}
        >
          <Input
            id="member-organization-phone"
            type="tel"
            value={form.contact_phone_number}
            hasError={!!errors.contact_phone_number}
            onChange={(event) =>
              onFieldChange("contact_phone_number", event.target.value)
            }
          />
        </FormField>
        <FormField label="SIRET" htmlFor="member-organization-siret" error={errors.siret}>
          <Input
            id="member-organization-siret"
            inputMode="numeric"
            value={form.siret}
            hasError={!!errors.siret}
            onChange={(event) => onFieldChange("siret", event.target.value)}
          />
        </FormField>
        <FormField
          label="Latitude"
          htmlFor="member-organization-latitude"
          error={errors.latitude}
        >
          <Input
            id="member-organization-latitude"
            type="number"
            step="any"
            value={form.latitude}
            hasError={!!errors.latitude}
            onChange={(event) => onFieldChange("latitude", event.target.value)}
          />
        </FormField>
        <FormField
          label="Longitude"
          htmlFor="member-organization-longitude"
          error={errors.longitude}
        >
          <Input
            id="member-organization-longitude"
            type="number"
            step="any"
            value={form.longitude}
            hasError={!!errors.longitude}
            onChange={(event) => onFieldChange("longitude", event.target.value)}
          />
        </FormField>
        <div className="admin-form-grid__wide">
          <CheckboxGroup
            error={errors.categories}
            label="Categories"
            labelId="member-organization-categories"
          >
            {CATEGORIES.map((category) => (
              <Checkbox
                checked={form.categories.includes(category)}
                key={category}
                label={category}
                onChange={() => onCategoryToggle(category)}
              />
            ))}
          </CheckboxGroup>
        </div>
      </div>

      {modalError && <ErrorMessage message={modalError} />}

      <ActionRow className="admin-actions">
        <Button type="submit">Enregistrer</Button>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </ActionRow>
    </form>
  );
}

function EventEditor({
  errors,
  form,
  modalError,
  title,
  onCancel,
  onCategoryToggle,
  onFieldChange,
  onSubmit,
}: {
  errors: EventFormErrors;
  form: EventForm;
  modalError: string | null;
  title: string;
  onCancel: () => void;
  onCategoryToggle: (category: EventCategory) => void;
  onFieldChange: <Key extends keyof EventForm>(
    field: Key,
    value: EventForm[Key],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="admin-create-account" onSubmit={onSubmit} noValidate>
      <h2>{title}</h2>
      <div className="admin-form-grid">
        <FormField label="Titre" htmlFor="member-event-title" error={errors.title}>
          <Input
            id="member-event-title"
            value={form.title}
            hasError={!!errors.title}
            onChange={(event) => onFieldChange("title", event.target.value)}
          />
        </FormField>
        <div className="admin-form-grid__wide">
          <CategorySelect
            error={errors.categories}
            labelId="member-event-categories"
            selected={form.categories}
            onToggle={onCategoryToggle}
          />
        </div>
        <FormField
          label="Description"
          htmlFor="member-event-description"
          className="admin-form-grid__wide"
          error={errors.description}
        >
          <Textarea
            id="member-event-description"
            rows={4}
            value={form.description}
            hasError={!!errors.description}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Date de debut"
          htmlFor="member-event-start"
          error={errors.start_date}
        >
          <Input
            id="member-event-start"
            type="datetime-local"
            value={form.start_date}
            hasError={!!errors.start_date}
            onChange={(event) => onFieldChange("start_date", event.target.value)}
          />
        </FormField>
        <FormField
          label="Date de fin"
          htmlFor="member-event-end"
          error={errors.end_date}
        >
          <Input
            id="member-event-end"
            type="datetime-local"
            value={form.end_date}
            hasError={!!errors.end_date}
            onChange={(event) => onFieldChange("end_date", event.target.value)}
          />
        </FormField>
        <FormField
          label="Adresse"
          htmlFor="member-event-address"
          className="admin-form-grid__wide"
          error={errors.address}
        >
          <Input
            id="member-event-address"
            value={form.address}
            hasError={!!errors.address}
            onChange={(event) => onFieldChange("address", event.target.value)}
          />
        </FormField>
        <FormField label="Ville" htmlFor="member-event-city" error={errors.city}>
          <Input
            id="member-event-city"
            value={form.city}
            hasError={!!errors.city}
            onChange={(event) => onFieldChange("city", event.target.value)}
          />
        </FormField>
        <FormField
          label="Code postal"
          htmlFor="member-event-postal-code"
          error={errors.postal_code}
        >
          <Input
            id="member-event-postal-code"
            inputMode="numeric"
            value={form.postal_code}
            hasError={!!errors.postal_code}
            onChange={(event) =>
              onFieldChange("postal_code", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Latitude"
          htmlFor="member-event-latitude"
          error={errors.latitude}
        >
          <Input
            id="member-event-latitude"
            type="number"
            step="any"
            value={form.latitude}
            hasError={!!errors.latitude}
            onChange={(event) => onFieldChange("latitude", event.target.value)}
          />
        </FormField>
        <FormField
          label="Longitude"
          htmlFor="member-event-longitude"
          error={errors.longitude}
        >
          <Input
            id="member-event-longitude"
            type="number"
            step="any"
            value={form.longitude}
            hasError={!!errors.longitude}
            onChange={(event) => onFieldChange("longitude", event.target.value)}
          />
        </FormField>
        <FormField label="Image" htmlFor="member-event-image" error={errors.image}>
          <Input
            id="member-event-image"
            type="url"
            value={form.image}
            hasError={!!errors.image}
            onChange={(event) => onFieldChange("image", event.target.value)}
          />
        </FormField>
        <FormField label="Source" htmlFor="member-event-source">
          <Input
            id="member-event-source"
            value={form.source}
            onChange={(event) => onFieldChange("source", event.target.value)}
          />
        </FormField>
      </div>

      {modalError && <ErrorMessage message={modalError} />}

      <ActionRow className="admin-actions">
        <Button type="submit">Enregistrer</Button>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </ActionRow>
    </form>
  );
}
