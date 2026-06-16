import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type TouchEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

import EmptyState from "../../../shared/components/feedback/EmptyState";
import FormModal from "../../../shared/components/forms/FormModal";
import HeaderWeather from "../../../shared/components/layout/HeaderWeather";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import { ROUTES } from "../../../shared/constants/routes";
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
import WeatherBadge from "../components/WeatherBadge";
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
type MobileSheetState = "preview" | "expanded";

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

const getEventsGridClassName = (eventsToDisplay: Event[]) =>
  `events-list__grid${
    eventsToDisplay.length === 1 ? " events-list__grid--single" : ""
  }`;

const statusSections: {
  status: ReturnType<typeof getEventStatus>;
  title: string;
  empty: string;
}[] = [
  {
    status: "current",
    title: "Événements en cours",
    empty: "Aucun evenement en cours.",
  },
  {
    status: "upcoming",
    title: "Les prochains événements",
    empty: "Aucun evenement prochain ne correspond a votre recherche.",
  },
  {
    status: "past",
    title: "Événements passes",
    empty: "Aucun evenement passe ne correspond a votre recherche.",
  },
];

export default function Home() {
  const location = useLocation();
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
  const [isMobile, setIsMobile] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>("preview");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortValue>(DEFAULT_SORT);
  const [personalizedEventsView, setPersonalizedEventsView] =
    useState<PersonalizedEventsView>("recommended");
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [mapEventSelection, setMapEventSelection] =
    useState<MapEventSelection | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const mobileSheetTouchStartY = useRef<number | null>(null);
  const [mapPeriodMode, setMapPeriodMode] =
    useState<EventPeriodMode>(DEFAULT_PERIOD_MODE);
  const [defaultMapPeriodValue] = useState(() =>
    getDefaultPeriodValue(DEFAULT_PERIOD_MODE),
  );
  const [mapPeriodValue, setMapPeriodValue] = useState(defaultMapPeriodValue);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const updateMobileState = () => setIsMobile(mediaQuery.matches);

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);
    document.body.classList.add("events-home-route");

    return () => {
      mediaQuery.removeEventListener("change", updateMobileState);
      document.body.classList.remove("events-home-route");
    };
  }, []);
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
  const shouldShowPersonalizedEvents = shouldUsePreferredEvents && !isMobile;
  const showRecommendedEvents =
    shouldShowPersonalizedEvents && personalizedEventsView === "recommended";
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
  const shouldShowMobileRecommendedEvents =
    shouldUsePreferredEvents && isMobile && recommendedEvents.length > 0;

  const displayedEvents = useMemo(
    () => {
      if (showRecommendedEvents) {
        return recommendedEvents;
      }

      return filteredEvents;
    },
    [filteredEvents, recommendedEvents, showRecommendedEvents],
  );
  const selectedMapEvent = useMemo(
    () =>
      mapEventSelection == null
        ? null
        : events.find((event) => event.id === mapEventSelection.eventId) ?? null,
    [events, mapEventSelection],
  );
  const mapEvents = useMemo(
    () => {
      const visibleMapEvents = displayedEvents.filter(
        (event) =>
          getEventStatus(event) !== "past" ||
          event.id === mapEventSelection?.eventId,
      );

      if (
        selectedMapEvent &&
        getEventCoordinates(selectedMapEvent) &&
        !visibleMapEvents.some((event) => event.id === selectedMapEvent.id)
      ) {
        return [...visibleMapEvents, selectedMapEvent];
      }

      return visibleMapEvents;
    },
    [
      displayedEvents,
      getEventCoordinates,
      mapEventSelection?.eventId,
      selectedMapEvent,
    ],
  );
  const activeMapEventSelection = useMemo(
    () =>
      mapEventSelection &&
      mapEvents.some((event) => event.id === mapEventSelection.eventId)
        ? mapEventSelection
        : null,
    [mapEvents, mapEventSelection],
  );
  const selectedEvent = useMemo(
    () =>
      selectedEventId == null
        ? null
        : displayedEvents.find((event) => event.id === selectedEventId) ??
          events.find((event) => event.id === selectedEventId) ??
          null,
    [displayedEvents, events, selectedEventId],
  );
  const selectedEventCoordinates = selectedEvent
    ? getEventCoordinates(selectedEvent)
    : null;
  const selectedEventOrganization = selectedEvent
    ? activeOrganizationsById.get(selectedEvent.organization_id)
    : null;
  const selectedEventDistance = selectedEvent
    ? getEventDistance(selectedEvent)
    : null;
  const selectedEventTicketingHref = selectedEvent
    ? getTicketingHref(selectedEvent.ticketing_link)
    : null;
  const selectedEventGoogleMapsHref = selectedEventCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${selectedEventCoordinates.latitude},${selectedEventCoordinates.longitude}`
    : null;
  const mobileSheetMode =
    selectedEvent && mobileSheetState === "expanded" ? "detail" : mobileSheetState;
  const profileHref = !currentUser
    ? ROUTES.PUBLIC.LOGIN
    : currentUser.role === "user"
      ? ROUTES.USER.PROFILE
      : currentUser.role === "organization"
        ? ROUTES.ORGANIZATION.PROFILE
        : currentUser.role === "admin"
          ? ROUTES.ADMIN.DASHBOARD
          : ROUTES.MODERATOR.DASHBOARD;

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
  const shouldShowMobileFilterButton =
    isSearchFocused || search.trim().length > 0 || hasFilters;

  const handleMapPeriodModeChange = (mode: EventPeriodMode) => {
    setMapPeriodMode(mode);
    setMapPeriodValue(getDefaultPeriodValue(mode));
  };

  const resetFilters = () => {
    setMapPeriodMode(DEFAULT_PERIOD_MODE);
    setMapPeriodValue(defaultMapPeriodValue);
    setSearch("");
    setCategory("all");
    setCity("all");
    setPriceFilter("all");
    setSort(DEFAULT_SORT);
    setSelectedEventId(null);
    setMobileSheetState("preview");
    setShowPastEvents(false);
  };

  const selectMobileEvent = (eventId: number, shouldRecordHistory = true) => {
    if (shouldRecordHistory && currentUser?.role === "user" && currentUser.user_id) {
      recordHistory(currentUser.user_id, eventId);
    }

    setSelectedEventId(eventId);
    setMobileSheetState("expanded");
    setMapEventSelection((currentSelection) => ({
      eventId,
      requestId: (currentSelection?.requestId ?? 0) + 1,
    }));
  };

  const handleMobileSearchSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setSelectedEventId(null);
    setMobileSheetState("expanded");
  };

  const openFilterModal = useCallback(() => {
    setIsFilterModalOpen(true);
  }, []);

  const closeFilterModal = useCallback(() => {
    setIsFilterModalOpen(false);
  }, []);

  const handleMobileSheetTouchStart = (touchEvent: TouchEvent<HTMLElement>) => {
    mobileSheetTouchStartY.current = touchEvent.touches[0]?.clientY ?? null;
  };

  const handleMobileSheetTouchEnd = (touchEvent: TouchEvent<HTMLElement>) => {
    const startY = mobileSheetTouchStartY.current;
    const endY = touchEvent.changedTouches[0]?.clientY ?? null;

    mobileSheetTouchStartY.current = null;
    if (startY == null || endY == null) return;

    const deltaY = endY - startY;
    if (deltaY < -36) {
      setMobileSheetState("expanded");
      return;
    }

    if (deltaY > 36) {
      setMobileSheetState("preview");
    }
  };

  const handleEventCardActivation = (eventId: number) => {
    if (isMobile) {
      selectMobileEvent(eventId);
      return;
    }

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

  useEffect(() => {
    const requestedEventId = Number(
      new URLSearchParams(location.search).get("event"),
    );

    if (!Number.isInteger(requestedEventId)) return;

    const requestedEvent = events.find((event) => event.id === requestedEventId);

    if (!requestedEvent || !getEventCoordinates(requestedEvent)) return;

    const focusTimer = window.setTimeout(() => {
      const eventStartDate = new Date(requestedEvent.start_date);

      if (!Number.isNaN(eventStartDate.getTime())) {
        setMapPeriodMode("month");
        setMapPeriodValue(
          `${eventStartDate.getFullYear()}-${String(
            eventStartDate.getMonth() + 1,
          ).padStart(2, "0")}`,
        );
      }

      if (getEventStatus(requestedEvent) === "past") {
        setShowPastEvents(true);
      }

      if (currentUser?.role === "user" && currentUser.user_id) {
        recordHistory(currentUser.user_id, requestedEventId);
      }

      setSelectedEventId(isMobile ? requestedEventId : null);
      if (isMobile) {
        setMobileSheetState("expanded");
      }
      setMapEventSelection((currentSelection) => ({
        eventId: requestedEventId,
        requestId: (currentSelection?.requestId ?? 0) + 1,
      }));
      mapSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [
    currentUser,
    events,
    getEventCoordinates,
    isMobile,
    location.search,
    recordHistory,
  ]);

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
              <dt>Distance</dt>
              <dd>
                {eventDistance != null
                  ? formatDistance(eventDistance)
                  : "Distance indisponible"}
              </dd>
            </div>
            <div>
              <dt>Prix</dt>
              <dd>{formatEventPrice(event.price)}</dd>
            </div>
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
        <div
          className={`events-mobile-topbar${
            shouldShowMobileFilterButton ? " events-mobile-topbar--has-filter" : ""
          }`}
          aria-label="Actions carte mobile"
        >
          <Link
            className="events-mobile-topbar__profile"
            to={profileHref}
            aria-label={currentUser ? "Ouvrir le profil" : "Connexion"}
          >
            <UserRound size={20} aria-hidden="true" />
          </Link>

          <form
            className="events-mobile-search"
            role="search"
            onSubmit={handleMobileSearchSubmit}
          >
            <Search size={16} aria-hidden="true" />
            <Input
              type="search"
              value={search}
              placeholder="Rechercher un evenement..."
              aria-label="Rechercher un evenement"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <Button
                aria-label="Effacer la recherche"
                className="events-mobile-search__clear"
                icon={<X size={16} aria-hidden="true" />}
                iconOnly
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setSelectedEventId(null);
                }}
              >
                Effacer
              </Button>
            )}
          </form>

          {shouldShowMobileFilterButton ? (
            <Button
              aria-label="Filtres et tri"
              className="events-mobile-topbar__filter"
              icon={<SlidersHorizontal size={19} aria-hidden="true" />}
              iconOnly
              size="icon"
              type="button"
              variant="secondary"
              onClick={openFilterModal}
              onPointerDown={(event) => {
                event.preventDefault();
              }}
              onPointerUp={(event) => {
                event.preventDefault();
                openFilterModal();
              }}
            >
              Filtres
            </Button>
          ) : (
              <HeaderWeather />
          )}
        </div>

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
              onClick={resetFilters}
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
          showPopups={!isMobile}
          onEventSelect={
            isMobile ? (eventId) => selectMobileEvent(eventId, false) : undefined
          }
        />
      </section>

      <section
        className={`events-list events-list--${mobileSheetMode}`}
        aria-labelledby="events-list-title"
        onTouchStart={handleMobileSheetTouchStart}
        onTouchEnd={handleMobileSheetTouchEnd}
      >
        <button
          className="events-list__sheet-handle"
          type="button"
          aria-label={
            mobileSheetMode === "preview"
              ? selectedEvent
                ? "Afficher le detail de l'evenement"
                : "Afficher les evenements"
              : "Reduire la liste des evenements"
          }
          onClick={() => {
            setMobileSheetState((state) =>
              state === "preview" ? "expanded" : "preview",
            );
          }}
        />
        {selectedEvent ? (
          <div className="event-mobile-detail" aria-label={selectedEvent.title}>
            <div className="event-mobile-detail__actions">
              <Button
                aria-label="Retour a la liste des evenements"
                className="event-mobile-detail__back"
                icon={<ArrowLeft size={18} aria-hidden="true" />}
                iconOnly
                size="icon"
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedEventId(null);
                  setMobileSheetState("expanded");
                }}
              >
                Retour
              </Button>
              <div className="event-mobile-detail__quick-actions">
                <ReportEventButton event={selectedEvent} />
                <FavoriteButton event={selectedEvent} />
              </div>
            </div>

            <div className="event-mobile-detail__heading">
              <p>{selectedEventOrganization?.name ?? "Organisateur"}</p>
              <h2>{selectedEvent.title}</h2>
            </div>

            <img
              className="event-mobile-detail__image"
              src={selectedEvent.image}
              alt=""
            />

            <div className="event-mobile-detail__info-grid">
              <span>
                <MapPin size={17} aria-hidden="true" />
                {selectedEvent.address}, {selectedEvent.postal_code}{" "}
                {selectedEvent.city}
              </span>
              <span>
                <CalendarDays size={17} aria-hidden="true" />
                {formatEventDateRange(selectedEvent)}
              </span>

              {selectedEventDistance != null && (
                <span>
                  <Navigation size={17} aria-hidden="true" />
                  {formatDistance(selectedEventDistance)}
                </span>
              )}
              <span>
                <Ticket size={17} aria-hidden="true" />
                {formatEventPrice(selectedEvent.price)}
              </span>
            </div>

            <div className="event-mobile-detail__categories">
              {getEventCategories(selectedEvent).map((eventCategory) => (
                <span key={eventCategory}>{eventCategory}</span>
              ))}
            </div>

            <p className="event-mobile-detail__description">
              {selectedEvent.description}
            </p>

            {selectedEventTicketingHref && (
              <a
                className="btn btn--secondary event-mobile-detail__link"
                href={selectedEventTicketingHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Lien billetterie
              </a>
            )}

            {selectedEventCoordinates && (
              <>
                <WeatherBadge
                  latitude={selectedEventCoordinates.latitude}
                  longitude={selectedEventCoordinates.longitude}
                  startDate={selectedEvent.start_date}
                />
                {selectedEventGoogleMapsHref && (
                  <a
                    className="btn btn--primary event-mobile-detail__maps"
                    href={selectedEventGoogleMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir dans Google Maps
                  </a>
                )}
              </>
            )}
          </div>
        ) : (
          <>

        {showRecommendedEvents ? (
          <section
            className="events-status-section"
            aria-labelledby="events-recommended-title"
          >
            <div className="events-status-section__header">
              <div className="events-status-section__title-actions">
                <h3 id="events-recommended-title">Mes recommandations</h3>
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
              <div className={getEventsGridClassName(displayedEvents)}>
                {displayedEvents.map(renderEventCard)}
              </div>
            )}
          </section>
        ) : (
          <>
            {shouldShowPersonalizedEvents && (
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

            {statusSections
              .filter((section) => section.status !== "past")
              .map((section) => {
              const sectionEvents = groupedEvents[section.status];
              const shouldRenderMobileRecommendations =
                section.status === "upcoming" && shouldShowMobileRecommendedEvents;

              if (section.status === "current" && sectionEvents.length === 0) {
                return null;
              }

              return (
                <Fragment key={section.status}>
                  {shouldRenderMobileRecommendations && (
                    <section
                      className="events-status-section"
                      aria-labelledby="events-mobile-recommended-title"
                    >
                      <div className="events-status-section__header">
                        <h3 id="events-mobile-recommended-title">
                          Mes recommandations
                        </h3>
                        <span>{recommendedEvents.length}</span>
                      </div>

                      <div className={getEventsGridClassName(recommendedEvents)}>
                        {recommendedEvents.map(renderEventCard)}
                      </div>
                    </section>
                  )}

                <section
                  className="events-status-section"
                  aria-labelledby={`events-${section.status}-title`}
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
                    <div className={getEventsGridClassName(sectionEvents)}>
                      {sectionEvents.map(renderEventCard)}
                    </div>
                  )}
                </section>
                </Fragment>
              );
            })}

            <section
              className={`events-status-section events-status-section--collapsible${
                showPastEvents ? " is-open" : ""
              }`}
              aria-labelledby="events-past-title"
            >
              <div className="events-status-section__header">
                <h3 id="events-past-title">
                  <button
                    aria-controls="events-past-panel"
                    aria-expanded={showPastEvents}
                    className="events-status-section__toggle"
                    type="button"
                    onClick={() => setShowPastEvents((value) => !value)}
                  >
                    <span>Voir les evenements passes</span>
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="events-status-section__toggle-icon"
                      />
                  </button>
                </h3>
              </div>

              <div
                className="events-status-section__collapsible"
                id="events-past-panel"
                aria-hidden={!showPastEvents}
                inert={!showPastEvents ? true : undefined}
              >
                <div className="events-status-section__collapsible-inner">
                  {groupedEvents.past.length === 0 ? (
                    <EmptyState message="Aucun evenement passe ne correspond a votre recherche." />
                  ) : (
                    <div className={getEventsGridClassName(groupedEvents.past)}>
                      {groupedEvents.past.map(renderEventCard)}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
          </>
        )}
      </section>

      <FormModal
        ariaLabel="Filtres et tri des evenements"
        open={isFilterModalOpen}
        size="lg"
        onClose={closeFilterModal}
      >
        <form
          className="events-filter-modal"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            closeFilterModal();
            setSelectedEventId(null);
            setMobileSheetState("expanded");
          }}
        >
          <div className="events-filter-modal__header">
            <h2>Filtres et tri</h2>
          </div>

          <section
            className="events-filter-modal__section"
            aria-labelledby="filter-period-title"
          >
            <h3 id="filter-period-title">Periode</h3>
            <div className="events-filter-modal__field-grid">
              <label className="events-filter-modal__field">
                <span>Afficher</span>
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

              <label className="events-filter-modal__field">
                <span>Selection</span>
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
            </div>
          </section>

          <section
            className="events-filter-modal__section"
            aria-labelledby="filter-refine-title"
          >
            <h3 id="filter-refine-title">Filtres</h3>
            <div className="events-filter-modal__field-grid">
              <label className="events-filter-modal__field">
                <span>Categorie</span>
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

              <label className="events-filter-modal__field">
                <span>Ville</span>
                <Select value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="all">Toutes les villes</option>
                  {availableCities.map((eventCity) => (
                    <option key={eventCity} value={eventCity}>
                      {eventCity}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="events-filter-modal__field">
                <span>Tarif</span>
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
            </div>
          </section>

          <section
            className="events-filter-modal__section"
            aria-labelledby="filter-sort-title"
          >
            <h3 id="filter-sort-title">Tri</h3>
            <label className="events-filter-modal__field">
              <span>Trier par</span>
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
          </section>

          <div className="events-filter-modal__actions">
            {hasFilters && (
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Reinitialiser
              </Button>
            )}
            <Button type="submit">Afficher les resultats</Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
