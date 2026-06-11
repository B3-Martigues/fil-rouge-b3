import { useCallback, useMemo, useRef, useState } from "react";

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
import FavoriteButton from "../components/FavoriteButton";
import ReportEventButton from "../components/ReportEventButton";
import useUserLocation from "../hooks/useUserLocation";

import {
  formatDistance,
  formatEventPrice,
  formatEventDateRange,
  getTicketingHref,
  getDistanceInKilometers,
  getDefaultPeriodValue,
  getEventStatus,
  getPeriodRange,
  hasEventCoordinates,
  isEventSuspended,
  isEventInPeriod,
  type GeoPoint,
  type EventPeriodMode,
} from "../utils/event";
import type { Event } from "../types/event";

type SortValue =
  | "date-asc"
  | "date-desc"
  | "distance-asc"
  | "popularity-desc"
  | "title-asc"
  | "title-desc"
  | "city-asc"
  | "price-asc"
  | "price-desc";

type PersonalizedEventsView = "recommended" | "all";
type PriceFilter = "all" | "free" | "paid";
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

export default function Home() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isUserAccount = currentUser?.role === "user";
  const currentUserId = isUserAccount ? currentUser.user_id : undefined;
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const userEventPreferences = useDataStore((s) => s.userEventPreferences);
  const favorites = useDataStore((s) => s.favorites);
  const histories = useDataStore((s) => s.histories);
  const recordHistory = useDataStore((s) => s.recordHistory);
  const { position: userPosition } = useUserLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
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
  const getEventCoordinates = useCallback(
    (event: Event): GeoPoint | null => {
      if (hasEventCoordinates(event)) {
        return {
          latitude: event.latitude,
          longitude: event.longitude,
        };
      }

      const organization = activeOrganizationsById.get(event.organization_id);

      if (organization?.latitude == null || organization.longitude == null) {
        return null;
      }

      return {
        latitude: organization.latitude,
        longitude: organization.longitude,
      };
    },
    [activeOrganizationsById],
  );
  const getEventDistance = useCallback(
    (event: Event) => {
      if (!userPosition) return null;

      const eventCoordinates = getEventCoordinates(event);

      return eventCoordinates
        ? getDistanceInKilometers(userPosition, eventCoordinates)
        : null;
    },
    [getEventCoordinates, userPosition],
  );
  const popularityByEventId = useMemo(() => {
    const popularity = new Map<number, number>();

    favorites
      .filter((favorite) => !favorite.deleted_at)
      .forEach((favorite) => {
        popularity.set(
          favorite.event_id,
          (popularity.get(favorite.event_id) ?? 0) + 1,
        );
      });

    histories
      .filter((history) => !history.deleted_at)
      .forEach((history) => {
        popularity.set(
          history.event_id,
          (popularity.get(history.event_id) ?? 0) + 1,
        );
      });

    return popularity;
  }, [favorites, histories]);
  const sortEvents = useCallback(
    (eventsToSort: Event[]) =>
      [...eventsToSort].sort((firstEvent, secondEvent) => {
        if (sort === "date-desc") {
          return (
            new Date(secondEvent.start_date).getTime() -
            new Date(firstEvent.start_date).getTime()
          );
        }

        if (sort === "distance-asc") {
          const firstDistance = getEventDistance(firstEvent);
          const secondDistance = getEventDistance(secondEvent);

          if (firstDistance == null && secondDistance == null) return 0;
          if (firstDistance == null) return 1;
          if (secondDistance == null) return -1;
          if (firstDistance !== secondDistance) return firstDistance - secondDistance;

          return (
            new Date(firstEvent.start_date).getTime() -
            new Date(secondEvent.start_date).getTime()
          );
        }

        if (sort === "popularity-desc") {
          const popularityDelta =
            (popularityByEventId.get(secondEvent.id) ?? 0) -
            (popularityByEventId.get(firstEvent.id) ?? 0);

          if (popularityDelta !== 0) return popularityDelta;

          return (
            new Date(firstEvent.start_date).getTime() -
            new Date(secondEvent.start_date).getTime()
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

        if (sort === "price-asc") {
          if (firstEvent.price !== secondEvent.price) {
            return firstEvent.price - secondEvent.price;
          }

          return (
            new Date(firstEvent.start_date).getTime() -
            new Date(secondEvent.start_date).getTime()
          );
        }

        if (sort === "price-desc") {
          if (firstEvent.price !== secondEvent.price) {
            return secondEvent.price - firstEvent.price;
          }

          return (
            new Date(firstEvent.start_date).getTime() -
            new Date(secondEvent.start_date).getTime()
          );
        }

        return (
          new Date(firstEvent.start_date).getTime() -
          new Date(secondEvent.start_date).getTime()
        );
      }),
    [getEventDistance, popularityByEventId, sort],
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
      currentUserId
        ? userEventPreferences
            .filter((preference) => preference.user_id === currentUserId)
            .map((preference) =>
              getEventCategorySlug(preference.event_category_id),
            )
            .filter((category): category is EventCategoryName => !!category)
        : [],
    [currentUserId, userEventPreferences],
  );
  const preferredCategorySet = useMemo(
    () => new Set(preferredCategories),
    [preferredCategories],
  );
  const shouldUsePreferredEvents =
    isUserAccount && preferredCategorySet.size > 0;
  const showRecommendedEvents =
    shouldUsePreferredEvents && personalizedEventsView === "recommended";
  const mapPeriod = useMemo(
    () => getPeriodRange(mapPeriodMode, mapPeriodValue),
    [mapPeriodMode, mapPeriodValue],
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return sortEvents(
      events.filter((event) => {
        if (!event.is_active || event.deleted_at) return false;
        if (isEventSuspended(event)) return false;
        const organization = activeOrganizationsById.get(event.organization_id);

        if (!organization) return false;
        if (!getEventCoordinates(event)) return false;
        if (!isEventInPeriod(event, mapPeriod.start, mapPeriod.end)) {
          return false;
        }

        const eventCategories = getEventCategories(event);
        const matchesCategory =
          category === "all" || eventCategories.includes(category);
        const matchesCity = city === "all" || event.city === city;
        const matchesPrice =
          priceFilter === "all" ||
          (priceFilter === "free" && event.price <= 0) ||
          (priceFilter === "paid" && event.price > 0);
        const searchableContent = normalizeText(
          [
            event.title,
            event.description,
            event.address,
            event.city,
            event.postal_code,
            formatEventPrice(event.price),
            event.ticketing_link,
            eventCategories.join(" "),
            event.source ?? "",
          ].join(" "),
        );

        return (
          matchesCategory &&
          matchesCity &&
          matchesPrice &&
          searchableContent.includes(normalizedSearch)
        );
      }),
    );
  }, [
    activeOrganizationsById,
    category,
    city,
    events,
    getEventCoordinates,
    mapPeriod.end,
    mapPeriod.start,
    priceFilter,
    search,
    sortEvents,
  ]);

  const recommendedEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => getEventStatus(event) !== "past")
        .filter(
          (event) => getPreferenceMatchCount(event, preferredCategorySet) > 0,
        ),
    [filteredEvents, preferredCategorySet],
  );

  const displayedEvents = useMemo(
    () => {
      if (showRecommendedEvents) {
        return recommendedEvents;
      }

      return filteredEvents;
    },
    [filteredEvents, recommendedEvents, showRecommendedEvents],
  );
  const mapEvents = useMemo(
    () => displayedEvents.filter((event) => getEventStatus(event) !== "past"),
    [displayedEvents],
  );
  const activeMapEventSelection = useMemo(
    () =>
      mapEventSelection &&
      mapEvents.some((event) => event.id === mapEventSelection.eventId)
        ? mapEventSelection
        : null,
    [mapEvents, mapEventSelection],
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
  const hasFilters =
    search.trim() !== "" ||
    category !== "all" ||
    city !== "all" ||
    priceFilter !== "all" ||
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

  const renderEventCard = (event: Event) => {
    const eventDistance = getEventDistance(event);
    const ticketingHref = getTicketingHref(event.ticketing_link);

    return (
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
              <dt>Adresse</dt>
              <dd>{event.address}</dd>
            </div>
            <div>
              <dt>Ville</dt>
              <dd>{event.city}</dd>
            </div>
            <div>
              <dt>Prix</dt>
              <dd>{formatEventPrice(event.price)}</dd>
            </div>
            {eventDistance != null && (
              <div>
                <dt>Distance</dt>
                <dd>{formatDistance(eventDistance)}</dd>
              </div>
            )}
          </dl>
          {ticketingHref && (
            <a
              className="btn btn--secondary event-card__ticketing-link"
              href={ticketingHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
            >
              Billetterie
            </a>
          )}
          <FavoriteButton event={event} />
          <ReportEventButton event={event} />
        </div>
      </article>
    );
  };

  return (
    <div className="events-home">
      <section className="events-home__header" ref={mapSectionRef}>
        <h1>Mappening</h1>
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

          <label>
            Tarif
            <Select
              value={priceFilter}
              onChange={(event) =>
                setPriceFilter(event.target.value as PriceFilter)
              }
            >
              <option value="all">Tous les tarifs</option>
              <option value="free">Gratuit</option>
              <option value="paid">Payant</option>
            </Select>
          </label>

          <label>
            Trier par
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortValue)}
            >
              <option value="date-asc">Date la plus proche</option>
              <option value="date-desc">Date la plus eloignee</option>
              <option value="distance-asc">Proximite</option>
              <option value="popularity-desc">Popularite</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="title-desc">Titre Z-A</option>
              <option value="city-asc">Ville A-Z</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix decroissant</option>
            </Select>
          </label>

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
                setPriceFilter("all");
                setSort(DEFAULT_SORT);
              }}
            >
              Reinitialiser
            </Button>
          )}
        </div>

        <EventMap
          events={mapEvents}
          selectedEventId={activeMapEventSelection?.eventId ?? null}
          selectedEventRequestId={activeMapEventSelection?.requestId ?? 0}
          userPosition={userPosition}
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
                    setPersonalizedEventsView("all")
                  }
                >
                  Voir tous les evenements
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
                aria-labelledby="events-all-title"
              >
                <div className="events-status-section__header">
                  <div className="events-status-section__title-actions">
                    <h3 id="events-all-title">
                      Tous les evenements
                    </h3>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setPersonalizedEventsView("recommended")}
                    >
                      Voir recommandes
                    </Button>
                  </div>
                  <span>{displayedEvents.length}</span>
                </div>
              </section>
            )}

            {statusSections.map((section) => {
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
