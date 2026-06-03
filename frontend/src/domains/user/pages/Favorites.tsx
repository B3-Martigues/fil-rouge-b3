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
    return <p>Aucun evenement en favoris</p>;
  }

  return (
    <div>
      <h1>Page de favoris</h1>
      <h2>Mes événements favoris</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: "30px" }}>
        {favoriteEvents.map((event) => (
          <div
            key={event.id}
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              borderRadius: "10px",
            }}
          >
            {event.image && (
              <img
                src={event.image}
                alt={event.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
            )}
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            <FavoriteButton event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
