import { useState } from "react";
import { toast } from "react-toastify";

import CategorySelect from "../../events/components/CategorySelect";
import EmptyState from "../../../shared/components/feedback/EmptyState";
import ConfirmDialog from "../../../shared/components/forms/ConfirmDialog";
import FormModal from "../../../shared/components/forms/FormModal";
import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import ActionRow from "../../../shared/components/layout/ActionRow";
import Toolbar from "../../../shared/components/layout/Toolbar";
import Button from "../../../shared/components/ui/Button";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import StatusBadge from "../../../shared/components/ui/StatusBadge";
import Textarea from "../../../shared/components/ui/Textarea";
import useAuthStore from "../../auth/store/authStore";
import type { EventCategory } from "../../events/types/event-categories";
import type { Event } from "../../events/types/event";
import useDataStore from "../../../shared/store/dataStore";
import { ROUTES } from "../../../shared/constants/routes";
import { useCompanyAccess } from "../hooks/useCompanyAccess";
import {
  formatDateTime,
  formatEventDateRange,
  toDateTimeLocalValue,
} from "../../events/utils/event";

type EventSort =
  | "created-desc"
  | "date-asc"
  | "date-desc"
  | "title-asc"
  | "city-asc";

type EventDraft = Omit<
  Event,
  | "id"
  | "latitude"
  | "longitude"
  | "company_id"
  | "postal_code"
  | "created_at"
  | "updated_at"
  | "category_slugs"
> & {
  latitude: string;
  longitude: string;
  postal_code: string;
  category_slugs: EventCategory[];
};

const toEventDraft = (event: Event): EventDraft => ({
  title: event.title,
  description: event.description,
  start_date: toDateTimeLocalValue(event.start_date),
  end_date: toDateTimeLocalValue(event.end_date),
  latitude: event.latitude?.toString() ?? "",
  longitude: event.longitude?.toString() ?? "",
  address: event.address,
  city: event.city,
  postal_code: event.postal_code,
  category_slugs: event.category_slugs,
  image: event.image,
  source:
    event.source === "company" || event.source === "Entreprise"
      ? "Evenement cree par une entreprise"
      : event.source ?? "",
  is_active: event.is_active,
});

const getEventCategories = (event: Event) => event.category_slugs;

const toggleDraftCategory = (
  draft: EventDraft,
  category: EventCategory,
): EventDraft => {
  const currentCategories = draft.category_slugs;
  const nextCategories = currentCategories.includes(category)
    ? currentCategories.filter((item) => item !== category)
    : [...currentCategories, category];

  return {
    ...draft,
    category_slugs: nextCategories,
  };
};

const isValidOptionalCoordinate = (value: string, min: number, max: number) => {
  if (value.trim() === "") return true;

  const numberValue = Number(value);
  return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
};

export default function CompanyEvents() {
  const { isPendingApproval } = useCompanyAccess();
  const currentUser = useAuthStore((s) => s.currentUser);
  const events = useDataStore((s) => s.events);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [eventCityFilter, setEventCityFilter] = useState("all");
  const [eventSort, setEventSort] = useState<EventSort>("created-desc");
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<number | null>(
    null,
  );

  const companyEvents = events.filter(
    (event) =>
      event.company_id === currentUser?.company_id && !event.deleted_at,
  );
  const companyCities = Array.from(
    new Set(companyEvents.map((event) => event.city.trim()).filter(Boolean)),
  ).sort((firstCity, secondCity) =>
    firstCity.localeCompare(secondCity, "fr-FR"),
  );
  const filteredCompanyEvents = companyEvents
    .filter((event) => {
      const normalizedSearch = eventSearch.trim().toLowerCase();
      const matchesSearch = [
        event.title,
        event.description,
        event.address,
        event.city,
        event.postal_code,
        getEventCategories(event).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesCity =
        eventCityFilter === "all" || event.city === eventCityFilter;

      return matchesSearch && matchesCity;
    })
    .sort((firstEvent, secondEvent) => {
      if (eventSort === "created-desc") {
        return (
          new Date(secondEvent.created_at ?? 0).getTime() -
          new Date(firstEvent.created_at ?? 0).getTime()
        );
      }

      if (eventSort === "date-desc") {
        return (
          new Date(secondEvent.start_date).getTime() -
          new Date(firstEvent.start_date).getTime()
        );
      }

      if (eventSort === "title-asc") {
        return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
      }

      if (eventSort === "city-asc") {
        return firstEvent.city.localeCompare(secondEvent.city, "fr-FR");
      }

      return (
        new Date(firstEvent.start_date).getTime() -
        new Date(secondEvent.start_date).getTime()
      );
    });

  const startEdit = (event: Event) => {
    setEditingEventId(event.id);
    setEventDraft(toEventDraft(event));
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEventDraft(null);
  };

  const saveEvent = () => {
    if (!editingEventId || !eventDraft || !currentUser?.company_id) return;
    const originalEvent = companyEvents.find(
      (event) => event.id === editingEventId,
    );

    if (!originalEvent) return;

    if (
      eventDraft.title.trim().length < 3 ||
      !eventDraft.start_date ||
      !eventDraft.end_date
    ) {
      toast.error("Le titre, le debut et la fin sont obligatoires");
      return;
    }

    if (new Date(eventDraft.end_date) < new Date(eventDraft.start_date)) {
      toast.error("La date de fin doit etre apres la date de debut");
      return;
    }

    if (eventDraft.description.trim().length < 10) {
      toast.error("La description doit contenir au moins 10 caracteres");
      return;
    }

    if (eventDraft.category_slugs.length === 0) {
      toast.error("Selectionnez au moins une categorie");
      return;
    }

    if (eventDraft.address.trim().length < 5) {
      toast.error("L'adresse est obligatoire");
      return;
    }

    if (eventDraft.city.trim().length < 2) {
      toast.error("La ville est obligatoire");
      return;
    }

    if (!/^\d{5}$/.test(eventDraft.postal_code.trim())) {
      toast.error("Le code postal doit contenir 5 chiffres");
      return;
    }

    if (!isValidOptionalCoordinate(eventDraft.latitude, -90, 90)) {
      toast.error("La latitude doit etre comprise entre -90 et 90");
      return;
    }

    if (!isValidOptionalCoordinate(eventDraft.longitude, -180, 180)) {
      toast.error("La longitude doit etre comprise entre -180 et 180");
      return;
    }

    if (!eventDraft.image.trim() || !URL.canParse(eventDraft.image.trim())) {
      toast.error("L'URL de l'image est invalide");
      return;
    }

    updateEvent(editingEventId, {
      title: eventDraft.title.trim(),
      description: eventDraft.description.trim(),
      start_date: new Date(eventDraft.start_date).toISOString(),
      end_date: new Date(eventDraft.end_date).toISOString(),
      latitude: eventDraft.latitude.trim() ? Number(eventDraft.latitude) : null,
      longitude: eventDraft.longitude.trim() ? Number(eventDraft.longitude) : null,
      address: eventDraft.address.trim(),
      city: eventDraft.city.trim(),
      postal_code: eventDraft.postal_code.trim(),
      category_slugs: eventDraft.category_slugs,
      image: eventDraft.image.trim(),
      source: eventDraft.source?.trim() || "Evenement cree par une entreprise",
      company_id: currentUser.company_id,
      is_active: false,
    });

    cancelEdit();
    toast.success("Evenement mis a jour, en attente de publication");
  };

  const deleteEvent = (eventId: number) => {
    const deletedEvent = companyEvents.find((event) => event.id === eventId);
    if (!deletedEvent) return;

    deleteEventFromStore(eventId);
    setPendingDeleteEventId(null);
    cancelEdit();
    toast.success(`${deletedEvent.title} supprime`);
  };

  const pendingDeleteEvent = companyEvents.find(
    (event) => event.id === pendingDeleteEventId,
  );

  if (isPendingApproval) {
    return (
      <div className="company-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre valide par un administrateur avant de pouvoir
          gerer des événements.
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <ConfirmDialog
        confirmLabel="Supprimer"
        message={
          pendingDeleteEvent
            ? `Supprimer l'evenement "${pendingDeleteEvent.title}" ? Cette action retire l'evenement du mock.`
            : "Supprimer cet evenement ?"
        }
        open={pendingDeleteEventId !== null}
        title="Supprimer l'evenement"
        onCancel={() => setPendingDeleteEventId(null)}
        onConfirm={() => {
          if (pendingDeleteEventId !== null) {
            deleteEvent(pendingDeleteEventId);
          }
        }}
      />

      <FormModal
        ariaLabel="Modifier un evenement"
        open={!!eventDraft && editingEventId !== null}
        size="lg"
        onClose={cancelEdit}
      >
        {eventDraft && (
          <CompanyEventEditor
            draft={eventDraft}
            setDraft={setEventDraft}
            onCancel={cancelEdit}
            onSave={saveEvent}
          />
        )}
      </FormModal>

      <section className="company-dashboard__header">
        <h2>Mes événements</h2>
        <p>Consultez, modifiez ou supprimez les événements de votre entreprise.</p>
      </section>

      <section className="company-events" aria-labelledby="company-events-title">
        <h2 id="company-events-title">Liste des événements</h2>

        <Toolbar
          ariaLabel="Filtres des evenements entreprise"
          className="admin-toolbar"
        >
          <label>
            Rechercher
            <Input
              value={eventSearch}
              placeholder="Titre, ville, code postal..."
              onChange={(event) => setEventSearch(event.target.value)}
            />
          </label>
          <label>
            Ville
            <Select
              value={eventCityFilter}
              onChange={(event) => setEventCityFilter(event.target.value)}
            >
              <option value="all">Toutes les villes</option>
              {companyCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Trier par
            <Select
              value={eventSort}
              onChange={(event) => setEventSort(event.target.value as EventSort)}
            >
              <option value="created-desc">Date de creation</option>
              <option value="date-asc">Debut croissant</option>
              <option value="date-desc">Debut decroissant</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="city-asc">Ville A-Z</option>
            </Select>
          </label>
        </Toolbar>

        {companyEvents.length === 0 ? (
          <EmptyState message="Aucun evenement cree pour le moment." />
        ) : filteredCompanyEvents.length === 0 ? (
          <EmptyState message="Aucun evenement ne correspond aux filtres." />
        ) : (
          <div className="company-review-list">
            {filteredCompanyEvents.map((event) => (
              <article className="company-review" key={event.id}>
                <div className="company-review__media">
                  <img src={event.image} alt={`Visuel ${event.title}`} />
                </div>

                <div className="company-review__content">
                  <>
                      <div className="company-review__header">
                        <div>
                          <h3>{event.title}</h3>
                          <p>{event.description}</p>
                        </div>
                        <StatusBadge
                          variant={event.is_active ? "active" : "pending"}
                        >
                          {event.is_active ? "Publie" : "En attente"}
                        </StatusBadge>
                      </div>
                      <dl className="company-review__details">
                        <div>
                          <dt>Debut / fin</dt>
                          <dd>{formatEventDateRange(event)}</dd>
                        </div>
                        <div>
                          <dt>Coordonnees</dt>
                          <dd>
                            {event.latitude ?? "Non renseignee"},{" "}
                            {event.longitude ?? "Non renseignee"}
                          </dd>
                        </div>
                        <div>
                          <dt>Adresse</dt>
                          <dd>{event.address}</dd>
                        </div>
                        <div>
                          <dt>Ville</dt>
                          <dd>{event.city}</dd>
                        </div>
                        <div>
                          <dt>Code postal</dt>
                          <dd>{event.postal_code}</dd>
                        </div>
                        <div>
                          <dt>Date de creation</dt>
                          <dd>
                            {event.created_at
                              ? formatDateTime(event.created_at)
                              : "Non renseignee"}
                          </dd>
                        </div>
                      </dl>
                      <div className="company-review__footer">
                        <div className="company-review__categories">
                          {getEventCategories(event).map((category) => (
                            <StatusBadge key={category}>
                              {category}
                            </StatusBadge>
                          ))}
                        </div>

                        <div className="admin-actions">
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => startEdit(event)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="danger"
                            type="button"
                            onClick={() => setPendingDeleteEventId(event.id)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </>

                </div>
              </article>
            ))}
          </div>
        )}
        <FormModalLink className="btn" to={ROUTES.COMPANY.CREATE}>
          Ajouter un nouvel evenement
        </FormModalLink>
      </section>
    </div>
  );
}

function CompanyEventEditor({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: EventDraft;
  setDraft: (draft: EventDraft | null) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="admin-create-account">
      <h2>Modifier un evenement</h2>
      <div className="admin-form-grid">
        <FormField label="Titre" htmlFor="company-event-title">
          <Input
            id="company-event-title"
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
        </FormField>

        <div className="admin-form-grid__wide">
          <CategorySelect
            labelId="company-event-categories"
            selected={draft.category_slugs}
            onToggle={(category) => setDraft(toggleDraftCategory(draft, category))}
          />
        </div>

        <FormField
          label="Description"
          htmlFor="company-event-description"
          className="admin-form-grid__wide"
        >
          <Textarea
            id="company-event-description"
            rows={4}
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
        </FormField>

        <FormField label="Date de debut" htmlFor="company-event-start-date">
          <Input
            id="company-event-start-date"
            type="datetime-local"
            value={draft.start_date}
            onChange={(event) =>
              setDraft({ ...draft, start_date: event.target.value })
            }
          />
        </FormField>

        <FormField label="Date de fin" htmlFor="company-event-end-date">
          <Input
            id="company-event-end-date"
            type="datetime-local"
            value={draft.end_date}
            onChange={(event) =>
              setDraft({ ...draft, end_date: event.target.value })
            }
          />
        </FormField>

        <FormField label="Adresse" htmlFor="company-event-address">
          <Input
            id="company-event-address"
            value={draft.address}
            onChange={(event) =>
              setDraft({ ...draft, address: event.target.value })
            }
          />
        </FormField>

        <FormField label="Ville" htmlFor="company-event-city">
          <Input
            id="company-event-city"
            value={draft.city}
            onChange={(event) =>
              setDraft({ ...draft, city: event.target.value })
            }
          />
        </FormField>

        <FormField label="Code postal" htmlFor="company-event-postal-code">
          <Input
            id="company-event-postal-code"
            inputMode="numeric"
            value={draft.postal_code}
            onChange={(event) =>
              setDraft({ ...draft, postal_code: event.target.value })
            }
          />
        </FormField>

        <FormField label="Latitude" htmlFor="company-event-latitude">
          <Input
            id="company-event-latitude"
            type="number"
            step="any"
            value={draft.latitude}
            onChange={(event) =>
              setDraft({ ...draft, latitude: event.target.value })
            }
          />
        </FormField>

        <FormField label="Longitude" htmlFor="company-event-longitude">
          <Input
            id="company-event-longitude"
            type="number"
            step="any"
            value={draft.longitude}
            onChange={(event) =>
              setDraft({ ...draft, longitude: event.target.value })
            }
          />
        </FormField>

        <FormField label="Image" htmlFor="company-event-image">
          <Input
            id="company-event-image"
            value={draft.image}
            onChange={(event) =>
              setDraft({ ...draft, image: event.target.value })
            }
          />
        </FormField>

        <ActionRow className="admin-actions admin-form-grid__wide">
          <Button type="button" onClick={onSave}>
            Enregistrer
          </Button>
          <Button variant="secondary" type="button" onClick={onCancel}>
            Annuler
          </Button>
        </ActionRow>
      </div>
    </div>
  );
}
