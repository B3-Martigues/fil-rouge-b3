import FavoriteButton from "../../events/components/FavoriteButton";
import useFavorites from "../hooks/useFavorites";
import useDataStore from "../../../shared/store/dataStore";

export default function Favorites() {
  const { favorites } = useFavorites();
  const events = useDataStore((s) => s.events);
  const companies = useDataStore((s) => s.companies);
  const activeCompanyIds = new Set(
    companies
      .filter((company) => company.is_active && !company.deleted_at)
      .map((company) => company.id),
  );
  const favoriteEvents = events.filter(
    (event) =>
      favorites.includes(event.id) &&
      event.is_active &&
      !event.deleted_at &&
      activeCompanyIds.has(event.company_id),
  );

  if (favoriteEvents.length === 0) {
    return (
      <p className="feedback-message feedback-message--empty">
        Aucun evenement en favoris
      </p>
    );
  }

  return (
    <div className="user-favorites">
      <h1>Page de favoris</h1>
      <h2>Mes événements favoris</h2>
      <div className="user-favorites__grid">
        {favoriteEvents.map((event) => (
          <article className="event-card" key={event.id}>
            {event.image && (
              <img
                className="event-card__image"
                src={event.image}
                alt={event.title}
              />
            )}
            <div className="event-card__content">
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <FavoriteButton event={event} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
