import { useMemo, useState } from "react";

import useDataStore from "../../../shared/store/dataStore";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../types/event-categories";
import EventMap from "../components/EventMap";
import {
  formatDateTime,
  formatEventDateRange,
  getDefaultPeriodValue,
  getEventStatus,
  getPeriodRange,
  type EventPeriodMode,
} from "../utils/event";
import type { Event } from "../types/event";

type SortValue =
  | "date-asc"
  | "date-desc"
  | "title-asc"
  | "title-desc"
  | "city-asc";

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getEventCategories = (event: {
  category_slugs: EventCategory[];
}) => event.category_slugs;

const statusSections: {
  status: ReturnType<typeof getEventStatus>;
  title: string;
  empty: string;
}[] = [
  {
    status: "current",
    title: "Evenements en cours",
    empty: "Aucun evenement en cours ne correspond a votre recherche.",
  },
  {
    status: "upcoming",
    title: "Evenements prochains",
    empty: "Aucun evenement prochain ne correspond a votre recherche.",
  },
  {
    status: "past",
    title: "Evenements passes",
    empty: "Aucun evenement passe ne correspond a votre recherche.",
  },
];

export default function Home() {
  const events = useDataStore((s) => s.events);
  const companies = useDataStore((s) => s.companies);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<SortValue>("date-asc");
  const [mapPeriodMode, setMapPeriodMode] =
    useState<EventPeriodMode>("week");
  const [mapPeriodValue, setMapPeriodValue] = useState(() =>
    getDefaultPeriodValue("week"),
  );
  const activeCompanyIds = useMemo(
    () =>
      new Set(
        companies
          .filter((company) => company.is_active && !company.deleted_at)
          .map((company) => company.id),
      ),
    [companies],
  );
  const availableCities = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .filter((event) => event.is_active)
            .filter((event) => !event.deleted_at)
            .filter((event) => activeCompanyIds.has(event.company_id))
            .map((event) => event.city.trim())
            .filter(Boolean),
        ),
      ).sort((firstCity, secondCity) =>
        firstCity.localeCompare(secondCity, "fr-FR"),
      ),
    [activeCompanyIds, events],
  );

  const visibleEvents = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return events
      .filter((event) => {
        if (!event.is_active || event.deleted_at) return false;
        if (!activeCompanyIds.has(event.company_id)) return false;

        const eventCategories = getEventCategories(event);
        const matchesCategory =
          category === "all" || eventCategories.includes(category);
        const matchesCity = city === "all" || event.city === city;
        const searchableContent = normalizeText(
          [
            event.title,
            event.description,
            event.address,
            event.city,
            event.postal_code,
            eventCategories.join(" "),
            event.source ?? "",
          ].join(" "),
        );

        return (
          matchesCategory &&
          matchesCity &&
          searchableContent.includes(normalizedSearch)
        );
      })
      .sort((firstEvent, secondEvent) => {
        if (sort === "date-desc") {
          return (
            new Date(secondEvent.start_date).getTime() -
            new Date(firstEvent.start_date).getTime()
          );
        }

        if (sort === "title-asc") {
          return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
        }

        if (sort === "title-desc") {
          return secondEvent.title.localeCompare(firstEvent.title, "fr-FR");
        }

        if (sort === "city-asc") {
          return firstEvent.city.localeCompare(secondEvent.city, "fr-FR");
        }

        return (
          new Date(firstEvent.start_date).getTime() -
          new Date(secondEvent.start_date).getTime()
        );
      });
  }, [activeCompanyIds, category, city, events, search, sort]);

  const groupedEvents = useMemo(
    () =>
      visibleEvents.reduce(
        (groups, event) => {
          groups[getEventStatus(event)].push(event);

          return groups;
        },
        {
          current: [] as Event[],
          upcoming: [] as Event[],
          past: [] as Event[],
        },
      ),
    [visibleEvents],
  );

  const mapPeriod = useMemo(
    () => getPeriodRange(mapPeriodMode, mapPeriodValue),
    [mapPeriodMode, mapPeriodValue],
  );

  const hasFilters =
    search.trim() !== "" || category !== "all" || city !== "all";

  const handleMapPeriodModeChange = (mode: EventPeriodMode) => {
    setMapPeriodMode(mode);
    setMapPeriodValue(getDefaultPeriodValue(mode));
  };

  const renderEventCard = (event: Event) => (
    <article className="event-card" key={event.id}>
      <img
        className="event-card__image"
        src={event.image}
        alt=""
        loading="lazy"
      />

      <div className="event-card__content">
        <div className="event-card__meta">
          <span>{getEventCategories(event).join(", ")}</span>
          <time dateTime={event.start_date}>{formatEventDateRange(event)}</time>
        </div>

        <h3>{event.title}</h3>
        <p>{event.description}</p>

        <dl className="event-card__details">
          <div>
            <dt>Debut</dt>
            <dd>{formatDateTime(event.start_date)}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{formatDateTime(event.end_date)}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>{event.address}</dd>
          </div>
          <div>
            <dt>Ville</dt>
            <dd>{event.city}</dd>
          </div>
        </dl>
      </div>
    </article>
  );

  return (
    <div className="events-home">
      <section className="events-home__header">
        <h1>Bienvenue sur la page d'accueil</h1>
        <p>Explorez les evenements disponibles autour de vous.</p>

        <div className="events-map-controls" aria-label="Filtres de la carte">
          <label>
            Periode
            <select
              className="input"
              value={mapPeriodMode}
              onChange={(event) =>
                handleMapPeriodModeChange(event.target.value as EventPeriodMode)
              }
            >
              <option value="day">Journee</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Annee</option>
            </select>
          </label>

          <label>
            Selection
            <input
              className="input"
              type={
                mapPeriodMode === "day"
                  ? "date"
                  : mapPeriodMode === "week"
                  ? "week"
                  : mapPeriodMode === "month"
                    ? "month"
                    : "number"
              }
              min={mapPeriodMode === "year" ? "1900" : undefined}
              max={mapPeriodMode === "year" ? "2100" : undefined}
              value={mapPeriodValue}
              onChange={(event) => setMapPeriodValue(event.target.value)}
            />
          </label>
        </div>

        <EventMap periodStart={mapPeriod.start} periodEnd={mapPeriod.end} />
      </section>

      <section className="events-list" aria-labelledby="events-list-title">
        <h2 id="events-list-title">Evenements</h2>

        <div className="events-toolbar" aria-label="Filtres des evenements">
          <label>
            Rechercher
            <input
              className="input"
              type="search"
              value={search}
              placeholder="Titre, ville, code postal..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            Categorie
            <select
              className="input"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as EventCategory | "all")
              }
            >
              <option value="all">Toutes les categories</option>
              {EVENT_CATEGORIES.map((eventCategory) => (
                <option key={eventCategory} value={eventCategory}>
                  {eventCategory}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ville
            <select
              className="input"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="all">Toutes les villes</option>
              {availableCities.map((eventCity) => (
                <option key={eventCity} value={eventCity}>
                  {eventCity}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trier par
            <select
              className="input"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortValue)}
            >
              <option value="date-asc">Debut croissant</option>
              <option value="date-desc">Debut decroissant</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="title-desc">Titre Z-A</option>
              <option value="city-asc">Ville A-Z</option>
            </select>
          </label>

          {hasFilters && (
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setCity("all");
              }}
            >
              Reinitialiser
            </button>
          )}
        </div>

        <p className="events-list__count">
          {visibleEvents.length} evenement{visibleEvents.length > 1 ? "s" : ""}
        </p>

        {statusSections.map((section) => {
          const sectionEvents = groupedEvents[section.status];

          return (
            <section
              className="events-status-section"
              aria-labelledby={`events-${section.status}-title`}
              key={section.status}
            >
              <div className="events-status-section__header">
                <h3 id={`events-${section.status}-title`}>{section.title}</h3>
                <span>{sectionEvents.length}</span>
              </div>

              {sectionEvents.length === 0 ? (
                <p className="admin-empty">{section.empty}</p>
              ) : (
                <div className="events-list__grid">
                  {sectionEvents.map(renderEventCard)}
                </div>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
}
