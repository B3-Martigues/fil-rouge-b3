import { eventsMock } from "../../events/mocks/events.mock";
import useFavorites from "../hooks/useFavorites";
import FavoriteButton from "../../events/components/FavoriteButton";

/* * Page affichant les événements favoris de l'utilisateur. */
export default function Favorites() {
  /**Récupération des IDs favoris */
  const { favorites } = useFavorites();

  /**Filtrage des événements selon les favoris */
  const favoriteEvents = eventsMock.filter((event) =>
    favorites.includes(event.id),
  );

  /**Cas vide */
  if (favoriteEvents.length === 0) {
    return <p>Aucun événement en favoris</p>;
  }

  return (
    <div>
      <h1>Page de favoris</h1>
      <h2>Mes événements favoris</h2>
      {/**Liste des événements favoris */}
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
            {/**Bouton favoris (toggle - remove/add) */}
            <FavoriteButton event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
