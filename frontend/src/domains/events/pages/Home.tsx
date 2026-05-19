/**
 * Page d'accueil publique.
 * Affiche la carte et la recherche d'événements.
 */

import { useMemo, useState } from "react";

import useDataStore from "../../../shared/store/dataStore";
import { EVENT_CATEGORIES, type EventCategory } from "../types/category";

type SortValue = "date-asc" | "date-desc" | "title-asc" | "title-desc";

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function Home() {
  const events = useDataStore((s) => s.events);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [sort, setSort] = useState<SortValue>("date-asc");

  const visibleEvents = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return events
      .filter((event) => {
        const matchesCategory = category === "all" || event.category === category;
        const searchableContent = normalizeText(
          [
            event.title,
            event.description,
            event.address ?? "",
            event.category,
            event.source ?? "",
          ].join(" "),
        );

        return matchesCategory && searchableContent.includes(normalizedSearch);
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

        return (
          new Date(firstEvent.date).getTime() -
          new Date(secondEvent.date).getTime()
        );
      });
  }, [category, events, search, sort]);

  const hasFilters = search.trim() !== "" || category !== "all";

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
              placeholder="Titre, description, adresse..."
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
            </select>
          </label>

          {hasFilters && (
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("all");
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
                    <span>{event.category}</span>
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
