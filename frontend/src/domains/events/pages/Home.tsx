/**
 * Page d'accueil publique.
 * Affiche la carte et la recherche d'événements.
 */

import { useMemo, useState } from "react";

import useDataStore from "../../../shared/store/dataStore";
import { EVENT_CATEGORIES, type EventCategory } from "../types/category";

type SortValue = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "city-asc";

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getEventCategories = (event: { category: EventCategory; categories?: EventCategory[] }) =>
  event.categories && event.categories.length > 0 ? event.categories : [event.category];

export default function Home() {
  const events = useDataStore((s) => s.events);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<SortValue>("date-asc");
  const availableCities = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .filter((event) => event.is_approved !== false)
            .map((event) => event.city?.trim())
            .filter((eventCity): eventCity is string => Boolean(eventCity)),
        ),
      ).sort((firstCity, secondCity) => firstCity.localeCompare(secondCity, "fr-FR")),
    [events],
  );

  const visibleEvents = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return events
      .filter((event) => {
        if (event.is_approved === false) return false;

        const eventCategories = getEventCategories(event);
        const matchesCategory = category === "all" || eventCategories.includes(category);
        const matchesCity = city === "all" || event.city === city;
        const searchableContent = normalizeText(
          [
            event.title,
            event.description,
            event.address ?? "",
            event.city ?? "",
            event.postal_code?.toString() ?? "",
            eventCategories.join(" "),
            event.source ?? "",
          ].join(" "),
        );

        return matchesCategory && matchesCity && searchableContent.includes(normalizedSearch);
      })
      .sort((firstEvent, secondEvent) => {
        if (sort === "date-desc") {
          return (
            new Date(secondEvent.date).getTime() -
            new Date(firstEvent.date).getTime()
          );
        }

        if (sort === "title-asc") {
          return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
        }

        if (sort === "title-desc") {
          return secondEvent.title.localeCompare(firstEvent.title, "fr-FR");
        }

        if (sort === "city-asc") {
          return (firstEvent.city ?? "").localeCompare(secondEvent.city ?? "", "fr-FR");
        }

        return (
          new Date(firstEvent.date).getTime() -
          new Date(secondEvent.date).getTime()
        );
      });
  }, [category, city, events, search, sort]);

  const hasFilters = search.trim() !== "" || category !== "all" || city !== "all";

  return (
    <div className="events-home">
      <section className="events-home__header">
        <h1>Bienvenue sur la carte des événements</h1>
        <p>Explorez les événements disponibles autour de vous.</p>
      </section>

      <section className="events-list" aria-labelledby="events-list-title">
        <h2 id="events-list-title">Tous les événements</h2>

        <div className="events-toolbar" aria-label="Filtres des événements">
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
            Catégorie
            <select
              className="input"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as EventCategory | "all")
              }
            >
              <option value="all">Toutes les catégories</option>
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
              <option value="date-asc">Date croissante</option>
              <option value="date-desc">Date décroissante</option>
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
              Réinitialiser
            </button>
          )}
        </div>

        <p className="events-list__count">
          {visibleEvents.length} événement{visibleEvents.length > 1 ? "s" : ""}
        </p>

        {visibleEvents.length === 0 ? (
          <p className="admin-empty">Aucun événement ne correspond à votre recherche.</p>
        ) : (
          <div className="events-list__grid">
            {visibleEvents.map((event) => (
              <article className="event-card" key={event.id}>
                {event.image && (
                  <img
                    className="event-card__image"
                    src={event.image}
                    alt=""
                    loading="lazy"
                  />
                )}

                <div className="event-card__content">
                  <div className="event-card__meta">
                    <span>{getEventCategories(event).join(", ")}</span>
                    <time dateTime={event.date}>
                      {new Date(event.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>

                  <h3>{event.title}</h3>
                  <p>{event.description}</p>

                  <dl className="event-card__details">
                    <div>
                      <dt>Horaire</dt>
                      <dd>
                        {new Date(event.date).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>Adresse</dt>
                      <dd>{event.address ?? "Adresse non renseignée"}</dd>
                    </div>
                    <div>
                      <dt>Ville</dt>
                      <dd>{event.city ?? "Ville non renseignée"}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
