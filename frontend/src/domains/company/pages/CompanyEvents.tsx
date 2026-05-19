import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { EVENT_CATEGORIES, type Event } from "../../events/types/category";
import useDataStore from "../../../shared/store/dataStore";
import { ROUTES } from "../../../shared/constants/routes";
import { useCompanyAccess } from "../hooks/useCompanyAccess";

type EventSort = "created-desc" | "date-asc" | "date-desc" | "title-asc" | "city-asc";

type EventDraft = Omit<
  Event,
  | "id"
  | "latitude"
  | "longitude"
  | "company_id"
  | "postal_code"
  | "created_at"
  | "updated_at"
> & {
  latitude: string;
  longitude: string;
  postal_code: string;
};

const toEventDraft = (event: Event): EventDraft => ({
  title: event.title,
  description: event.description,
  date: event.date.slice(0, 16),
  latitude: String(event.latitude),
  longitude: String(event.longitude),
  address: event.address ?? "",
  city: event.city ?? "",
  postal_code: event.postal_code?.toString() ?? "",
  category: event.category,
  categories: event.categories ?? [event.category],
  image: event.image ?? "",
  source:
    event.source === "company" || event.source === "Entreprise"
      ? "Évènement créé par une entreprise"
      : event.source ?? "",
});

const getEventCategories = (event: Event) =>
  event.categories && event.categories.length > 0 ? event.categories : [event.category];

const toggleDraftCategory = (
  draft: EventDraft,
  category: Event["category"],
): EventDraft => {
  const currentCategories = draft.categories ?? [draft.category];
  const nextCategories = currentCategories.includes(category)
    ? currentCategories.filter((item) => item !== category)
    : [...currentCategories, category];

  return {
    ...draft,
    category: nextCategories[0] ?? draft.category,
    categories: nextCategories,
  };
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

  const companyEvents = events.filter((event) => event.company_id === currentUser?.id);
  const companyCities = Array.from(
    new Set(
      companyEvents
        .map((event) => event.city?.trim())
        .filter((city): city is string => Boolean(city)),
    ),
  ).sort((firstCity, secondCity) => firstCity.localeCompare(secondCity, "fr-FR"));
  const filteredCompanyEvents = companyEvents
    .filter((event) => {
      const normalizedSearch = eventSearch.trim().toLowerCase();
      const matchesSearch = [
        event.title,
        event.description,
        event.address ?? "",
        event.city ?? "",
        event.postal_code?.toString() ?? "",
        getEventCategories(event).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesCity = eventCityFilter === "all" || event.city === eventCityFilter;

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
          new Date(secondEvent.date).getTime() - new Date(firstEvent.date).getTime()
        );
      }

      if (eventSort === "title-asc") {
        return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
      }

      if (eventSort === "city-asc") {
        return (firstEvent.city ?? "").localeCompare(secondEvent.city ?? "", "fr-FR");
      }

      return new Date(firstEvent.date).getTime() - new Date(secondEvent.date).getTime();
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
    if (!editingEventId || !eventDraft || !currentUser) return;
    const originalEvent = companyEvents.find((event) => event.id === editingEventId);

    if (!originalEvent) return;

    if (!eventDraft.title.trim() || !eventDraft.date) {
      toast.error("Le titre et la date sont obligatoires");
      return;
    }

    updateEvent(editingEventId, {
      title: eventDraft.title.trim(),
      description: eventDraft.description.trim(),
      date: new Date(eventDraft.date).toISOString(),
      latitude: Number(eventDraft.latitude),
      longitude: Number(eventDraft.longitude),
      address: eventDraft.address?.trim() || undefined,
      city: eventDraft.city?.trim() || undefined,
      postal_code: eventDraft.postal_code ? Number(eventDraft.postal_code) : undefined,
      category: (eventDraft.categories?.[0] ?? eventDraft.category) as Event["category"],
      categories: eventDraft.categories,
      image: eventDraft.image?.trim() || undefined,
      source: eventDraft.source?.trim() || "Évènement créé par une entreprise",
      company_id: currentUser.id,
      is_approved: false,
    });

    cancelEdit();
    toast.success("Évènement mis a jour, en attente de validation");
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
          gerer des évènements.
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Mes évènements</h2>
        <p>Consultez, modifiez ou supprimez les évènements de votre entreprise.</p>
      </section>

      <section className="company-events" aria-labelledby="company-events-title">
        <h2 id="company-events-title">Liste des évènements</h2>

        <div className="admin-toolbar" aria-label="Filtres des évènements entreprise">
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
              <option value="created-desc">Date de création</option>
              <option value="date-asc">Date croissante</option>
              <option value="date-desc">Date decroissante</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="city-asc">Ville A-Z</option>
            </select>
          </label>
        </div>

        {companyEvents.length === 0 ? (
          <p className="admin-empty">Aucun évènement cree pour le moment.</p>
        ) : filteredCompanyEvents.length === 0 ? (
          <p className="admin-empty">Aucun évènement ne correspond aux filtres.</p>
        ) : (
          <div className="company-review-list">
            {filteredCompanyEvents.map((event) => (
              <article className="company-review" key={event.id}>
                <div className="company-review__media">
                  {event.image && <img src={event.image} alt={`Visuel ${event.title}`} />}
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
                              checked={(eventDraft.categories ?? [eventDraft.category]).includes(
                                category,
                              )}
                              onChange={() =>
                                setEventDraft(toggleDraftCategory(eventDraft, category))
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
                      Date
                      <input
                        type="datetime-local"
                        value={eventDraft.date}
                        onChange={(inputEvent) =>
                          setEventDraft({
                            ...eventDraft,
                            date: inputEvent.target.value,
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
                          event.is_approved === false ? "" : "admin-status--active"
                        }`}
                      >
                        {event.is_approved === false ? "En attente" : "Validé"}
                      </span>
                    </div>
                    <dl className="company-review__details">
                      <div>
                        <dt>Date</dt>
                        <dd>{new Date(event.date).toLocaleString("fr-FR")}</dd>
                      </div>
                      <div>
                        <dt>Coordonnees</dt>
                        <dd>
                          {event.latitude}, {event.longitude}
                        </dd>
                      </div>
                      <div>
                        <dt>Adresse</dt>
                        <dd>{event.address ?? "Non renseignee"}</dd>
                      </div>
                      <div>
                        <dt>Ville</dt>
                        <dd>{event.city ?? "Non renseignee"}</dd>
                      </div>
                      <div>
                        <dt>Code postal</dt>
                        <dd>
                          {event.postal_code ?? "Non renseigne"}
                        </dd>
                      </div>
                      <div>
                        <dt>Date de creation</dt>
                        <dd>
                          {event.created_at
                            ? new Date(event.created_at).toLocaleString("fr-FR")
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
          Ajouter un nouvel évènement
        </Link>
      </section>
    </div>
  );
}
