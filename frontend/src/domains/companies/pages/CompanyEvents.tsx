import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../../events/types/event-categories";
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
      latitude: eventDraft.latitude ? Number(eventDraft.latitude) : null,
      longitude: eventDraft.longitude ? Number(eventDraft.longitude) : null,
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
    cancelEdit();
    toast.success(`${deletedEvent.title} supprime`);
  };

  if (isPendingApproval) {
    return (
      <div className="company-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre valide par un administrateur avant de pouvoir
          gerer des evenements.
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Mes evenements</h2>
        <p>Consultez, modifiez ou supprimez les evenements de votre entreprise.</p>
      </section>

      <section className="company-events" aria-labelledby="company-events-title">
        <h2 id="company-events-title">Liste des evenements</h2>

        <div className="admin-toolbar" aria-label="Filtres des evenements entreprise">
          <label>
            Rechercher
            <input
              value={eventSearch}
              placeholder="Titre, ville, code postal..."
              onChange={(event) => setEventSearch(event.target.value)}
            />
          </label>
          <label>
            Ville
            <select
              value={eventCityFilter}
              onChange={(event) => setEventCityFilter(event.target.value)}
            >
              <option value="all">Toutes les villes</option>
              {companyCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trier par
            <select
              value={eventSort}
              onChange={(event) => setEventSort(event.target.value as EventSort)}
            >
              <option value="created-desc">Date de creation</option>
              <option value="date-asc">Debut croissant</option>
              <option value="date-desc">Debut decroissant</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="city-asc">Ville A-Z</option>
            </select>
          </label>
        </div>

        {companyEvents.length === 0 ? (
          <p className="admin-empty">Aucun evenement cree pour le moment.</p>
        ) : filteredCompanyEvents.length === 0 ? (
          <p className="admin-empty">Aucun evenement ne correspond aux filtres.</p>
        ) : (
          <div className="company-review-list">
            {filteredCompanyEvents.map((event) => (
              <article className="company-review" key={event.id}>
                <div className="company-review__media">
                  <img src={event.image} alt={`Visuel ${event.title}`} />
                </div>

                <div className="company-review__content">
                  {editingEventId === event.id && eventDraft ? (
                    <div className="admin-form-grid">
                      <label>
                        Titre
                        <input
                          value={eventDraft.title}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              title: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <div className="admin-form-grid__wide">
                        <span className="form-field-label">Categories</span>
                        <div className="categories-select">
                          {EVENT_CATEGORIES.map((category) => (
                            <label className="categories-select__option" key={category}>
                              <input
                                type="checkbox"
                                checked={eventDraft.category_slugs.includes(category)}
                                onChange={() =>
                                  setEventDraft(
                                    toggleDraftCategory(eventDraft, category),
                                  )
                                }
                              />
                              {category}
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="admin-form-grid__wide">
                        Description
                        <textarea
                          rows={4}
                          value={eventDraft.description}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              description: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Date de debut
                        <input
                          type="datetime-local"
                          value={eventDraft.start_date}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              start_date: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Date de fin
                        <input
                          type="datetime-local"
                          value={eventDraft.end_date}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              end_date: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Adresse
                        <input
                          value={eventDraft.address}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              address: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Ville
                        <input
                          value={eventDraft.city}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              city: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Code postal
                        <input
                          inputMode="numeric"
                          value={eventDraft.postal_code}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              postal_code: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Latitude
                        <input
                          type="number"
                          step="any"
                          value={eventDraft.latitude}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              latitude: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Longitude
                        <input
                          type="number"
                          step="any"
                          value={eventDraft.longitude}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              longitude: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Image
                        <input
                          value={eventDraft.image}
                          onChange={(inputEvent) =>
                            setEventDraft({
                              ...eventDraft,
                              image: inputEvent.target.value,
                            })
                          }
                        />
                      </label>

                      <div className="admin-actions admin-form-grid__wide">
                        <button className="btn" type="button" onClick={saveEvent}>
                          Enregistrer
                        </button>
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={cancelEdit}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="company-review__header">
                        <div>
                          <h3>{event.title}</h3>
                          <p>{event.description}</p>
                        </div>
                        <span
                          className={`admin-status ${
                            event.is_active ? "admin-status--active" : ""
                          }`}
                        >
                          {event.is_active ? "Publie" : "En attente"}
                        </span>
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
                            <span className="admin-badge" key={category}>
                              {category}
                            </span>
                          ))}
                        </div>

                        <div className="admin-actions">
                          <button
                            className="btn btn--secondary"
                            type="button"
                            onClick={() => startEdit(event)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn btn--danger"
                            type="button"
                            onClick={() => deleteEvent(event.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <Link className="btn" to={ROUTES.COMPANY.CREATE}>
          Ajouter un nouvel evenement
        </Link>
      </section>
    </div>
  );
}
