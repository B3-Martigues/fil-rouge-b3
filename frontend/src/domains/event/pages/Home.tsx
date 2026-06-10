import { useMemo, useRef, useState } from "react";

import EmptyState from "../../../shared/components/feedback/EmptyState";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import {
  EVENT_CATEGORIES,
  getEventCategorySlug,
  type EventCategory,
  type EventCategoryName,
} from "../types/event-categories";
import EventMap from "../components/EventMap";
import ReportEventButton from "../components/ReportEventButton";
import {
  formatDateTime,
  formatEventDateRange,
  getDefaultPeriodValue,
  getEventStatus,
  getPeriodRange,
  hasEventCoordinates,
  isEventSuspended,
  isEventInPeriod,
  type EventPeriodMode,
} from "../utils/event";
import type { Event } from "../types/event";

type SortValue =
  | "date-asc"
  | "date-desc"
  | "title-asc"
  | "title-desc"
  | "city-asc";

type PersonalizedEventsView = "recommended" | "current-upcoming";
type MapEventSelection = {
  eventId: number;
  requestId: number;
};

const DEFAULT_PERIOD_MODE: EventPeriodMode = "month";
const DEFAULT_SORT: SortValue = "date-asc";

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getEventCategories = (event: {
  category_slugs: EventCategory[];
}) => event.category_slugs;

const getPreferenceMatchCount = (
  event: { category_slugs: EventCategory[] },
  preferredCategorySet: Set<EventCategoryName>,
) =>
  getEventCategories(event).filter((eventCategory) =>
    preferredCategorySet.has(eventCategory),
  ).length;

const statusSections: {
  status: ReturnType<typeof getEventStatus>;
  title: string;
  empty: string;
}[] = [
  {
    status: "current",
    title: "Événements en cours",
    empty: "Aucun evenement en cours ne correspond a votre recherche.",
  },
  {
    status: "upcoming",
    title: "Événements prochains",
    empty: "Aucun evenement prochain ne correspond a votre recherche.",
  },
  {
    status: "past",
    title: "Événements passes",
    empty: "Aucun evenement passe ne correspond a votre recherche.",
  },
];

const userStatusSections = statusSections.filter(
  (section) => section.status !== "past",
);

export default function Home() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserRole = currentUser?.role;
  const currentUserId = currentUser?.user_id;
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const userEventPreferences = useDataStore((s) => s.userEventPreferences);
  const recordHistory = useDataStore((s) => s.recordHistory);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<SortValue>(DEFAULT_SORT);
  const [personalizedEventsView, setPersonalizedEventsView] =
    useState<PersonalizedEventsView>("recommended");
  const [mapEventSelection, setMapEventSelection] =
    useState<MapEventSelection | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const [mapPeriodMode, setMapPeriodMode] =
    useState<EventPeriodMode>(DEFAULT_PERIOD_MODE);
  const [defaultMapPeriodValue] = useState(() =>
    getDefaultPeriodValue(DEFAULT_PERIOD_MODE),
  );
  const [mapPeriodValue, setMapPeriodValue] = useState(defaultMapPeriodValue);
  const activeOrganizationsById = useMemo(
    () =>
      new Map(
        organizations
          .filter((organization) => organization.is_active && !organization.deleted_at)
          .map((organization) => [organization.id, organization]),
      ),
    [organizations],
  );
  const availableCities = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .filter((event) => event.is_active)
            .filter((event) => !isEventSuspended(event))
            .filter((event) => !event.deleted_at)
            .filter((event) => {
              const organization = activeOrganizationsById.get(event.organization_id);

              if (!organization) return false;

              return (
                hasEventCoordinates(event) ||
                (organization.latitude != null && organization.longitude != null)
              );
            })
            .map((event) => event.city.trim())
            .filter(Boolean),
        ),
      ).sort((firstCity, secondCity) =>
        firstCity.localeCompare(secondCity, "fr-FR"),
      ),
    [activeOrganizationsById, events],
  );
  const preferredCategories = useMemo(
    () =>
      currentUserRole === "user" && currentUserId
        ? userEventPreferences
            .filter((preference) => preference.user_id === currentUserId)
            .map((preference) =>
              getEventCategorySlug(preference.event_category_id),
            )
            .filter((category): category is EventCategoryName => !!category)
        : [],
    [currentUserId, currentUserRole, userEventPreferences],
  );
  const preferredCategorySet = useMemo(
    () => new Set(preferredCategories),
    [preferredCategories],
  );
  const shouldUsePreferredEvents =
    currentUserRole === "user" && preferredCategorySet.size > 0;
  const showRecommendedEvents =
    shouldUsePreferredEvents && personalizedEventsView === "recommended";
  const mapPeriod = useMemo(
    () => getPeriodRange(mapPeriodMode, mapPeriodValue),
    [mapPeriodMode, mapPeriodValue],
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return events
      .filter((event) => {
        if (!event.is_active || event.deleted_at) return false;
        if (isEventSuspended(event)) return false;
        const organization = activeOrganizationsById.get(event.organization_id);

        if (!organization) return false;
        if (
          !hasEventCoordinates(event) &&
          (organization.latitude == null || organization.longitude == null)
        ) {
          return false;
        }
        if (!isEventInPeriod(event, mapPeriod.start, mapPeriod.end)) {
          return false;
        }

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
  }, [
    activeOrganizationsById,
    category,
    city,
    events,
    mapPeriod.end,
    mapPeriod.start,
    search,
    sort,
  ]);

  const recommendedEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => getEventStatus(event) !== "past")
        .filter(
          (event) => getPreferenceMatchCount(event, preferredCategorySet) > 0,
        )
        .sort((firstEvent, secondEvent) => {
          const firstMatchCount = getPreferenceMatchCount(
            firstEvent,
            preferredCategorySet,
          );
          const secondMatchCount = getPreferenceMatchCount(
            secondEvent,
            preferredCategorySet,
          );

          if (firstMatchCount !== secondMatchCount) {
            return secondMatchCount - firstMatchCount;
          }

          return (
            new Date(firstEvent.start_date).getTime() -
            new Date(secondEvent.start_date).getTime()
          );
        }),
    [filteredEvents, preferredCategorySet],
  );

  const displayedEvents = useMemo(
    () => {
      if (showRecommendedEvents) {
        return recommendedEvents;
      }

      if (currentUserRole) {
        return filteredEvents.filter((event) => getEventStatus(event) !== "past");
      }

      return filteredEvents;
    },
    [
      currentUserRole,
      filteredEvents,
      recommendedEvents,
      showRecommendedEvents,
    ],
  );
  const activeMapEventSelection = useMemo(
    () =>
      mapEventSelection &&
      displayedEvents.some((event) => event.id === mapEventSelection.eventId)
        ? mapEventSelection
        : null,
    [displayedEvents, mapEventSelection],
  );

  const groupedEvents = useMemo(
    () =>
      displayedEvents.reduce(
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
    [displayedEvents],
  );
  const currentUpcomingEventsCount =
    groupedEvents.current.length + groupedEvents.upcoming.length;
  const visibleStatusSections = currentUserRole
    ? userStatusSections
    : statusSections;

  const hasFilters =
    search.trim() !== "" ||
    category !== "all" ||
    city !== "all" ||
    sort !== DEFAULT_SORT ||
    mapPeriodMode !== DEFAULT_PERIOD_MODE ||
    mapPeriodValue !== defaultMapPeriodValue;

  const handleMapPeriodModeChange = (mode: EventPeriodMode) => {
    setMapPeriodMode(mode);
    setMapPeriodValue(getDefaultPeriodValue(mode));
  };

  const handleEventCardActivation = (eventId: number) => {
    if (currentUser?.role === "user" && currentUser.user_id) {
      recordHistory(currentUser.user_id, eventId);
    }

    setMapEventSelection((currentSelection) => ({
      eventId,
      requestId: (currentSelection?.requestId ?? 0) + 1,
    }));
    mapSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const renderEventCard = (event: Event) => (
    <article
      aria-label={`Afficher ${event.title} sur la carte`}
      aria-pressed={activeMapEventSelection?.eventId === event.id}
      className={`event-card event-card--interactive${
        activeMapEventSelection?.eventId === event.id
          ? " event-card--selected"
          : ""
      }`}
      key={event.id}
      role="button"
      tabIndex={0}
      onClick={() => handleEventCardActivation(event.id)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;

        keyboardEvent.preventDefault();
        handleEventCardActivation(event.id);
      }}
    >
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

        <ReportEventButton event={event} />
      </div>
    </article>
  );

  return (
    <div className="events-home">
      <section className="events-home__header" ref={mapSectionRef}>
        <h1>Bienvenue sur la page d'accueil</h1>
        <p>Explorez les événements disponibles autour de vous.</p>

        <div
          className="events-map-controls"
          aria-label="Filtres des evenements"
        >
          <label>
            Rechercher
            <Input
              type="search"
              value={search}
              placeholder="Titre, ville, code postal..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            Periode
            <Select
              value={mapPeriodMode}
              onChange={(event) =>
                handleMapPeriodModeChange(event.target.value as EventPeriodMode)
              }
            >
              <option value="day">Journee</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Annee</option>
            </Select>
          </label>

          <label>
            Selection
            <Input
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

          <label>
            Categorie
            <Select
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
            </Select>
          </label>

          <label>
            Ville
            <Select
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="all">Toutes les villes</option>
              {availableCities.map((eventCity) => (
                <option key={eventCity} value={eventCity}>
                  {eventCity}
                </option>
              ))}
            </Select>
          </label>

          {!showRecommendedEvents && (
            <label>
              Trier par
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
              >
                <option value="date-asc">Debut croissant</option>
                <option value="date-desc">Debut decroissant</option>
                <option value="title-asc">Titre A-Z</option>
                <option value="title-desc">Titre Z-A</option>
                <option value="city-asc">Ville A-Z</option>
              </Select>
            </label>
          )}

          {hasFilters && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setMapPeriodMode(DEFAULT_PERIOD_MODE);
                setMapPeriodValue(defaultMapPeriodValue);
                setSearch("");
                setCategory("all");
                setCity("all");
                setSort(DEFAULT_SORT);
              }}
            >
              Reinitialiser
            </Button>
          )}
        </div>

        <EventMap
          events={displayedEvents}
          selectedEventId={activeMapEventSelection?.eventId ?? null}
          selectedEventRequestId={activeMapEventSelection?.requestId ?? 0}
        />
      </section>

      <section className="events-list" aria-labelledby="events-list-title">
        <h2 id="events-list-title">Événements</h2>

        <p className="events-list__count">
          {displayedEvents.length} evenement
          {displayedEvents.length > 1 ? "s" : ""}
        </p>

        {showRecommendedEvents ? (
          <section
            className="events-status-section"
            aria-labelledby="events-recommended-title"
          >
            <div className="events-status-section__header">
              <div className="events-status-section__title-actions">
                <h3 id="events-recommended-title">Evenements recommandes</h3>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    setPersonalizedEventsView("current-upcoming")
                  }
                >
                  Voir en cours / a venir
                </Button>
              </div>
              <span>{displayedEvents.length}</span>
            </div>

            {displayedEvents.length === 0 ? (
              <EmptyState message="Aucun evenement ne correspond a vos preferences." />
            ) : (
              <div className="events-list__grid">
                {displayedEvents.map(renderEventCard)}
              </div>
            )}
          </section>
        ) : (
          <>
            {shouldUsePreferredEvents && (
              <section
                className="events-status-section"
                aria-labelledby="events-current-upcoming-title"
              >
                <div className="events-status-section__header">
                  <div className="events-status-section__title-actions">
                    <h3 id="events-current-upcoming-title">
                      Evenements en cours / a venir
                    </h3>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setPersonalizedEventsView("recommended")}
                    >
                      Voir recommandes
                    </Button>
                  </div>
                  <span>{currentUpcomingEventsCount}</span>
                </div>
              </section>
            )}

            {visibleStatusSections.map((section) => {
              const sectionEvents = groupedEvents[section.status];

              return (
                <section
                  className="events-status-section"
                  aria-labelledby={`events-${section.status}-title`}
                  key={section.status}
                >
                  <div className="events-status-section__header">
                    <h3 id={`events-${section.status}-title`}>
                      {section.title}
                    </h3>
                    <span>{sectionEvents.length}</span>
                  </div>

                  {sectionEvents.length === 0 ? (
                    <EmptyState message={section.empty} />
                  ) : (
                    <div className="events-list__grid">
                      {sectionEvents.map(renderEventCard)}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </section>
    </div>
  );
}
