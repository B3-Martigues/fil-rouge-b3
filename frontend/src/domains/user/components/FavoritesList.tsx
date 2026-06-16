import { Trash2 } from "lucide-react";

import Button from "../../../shared/components/ui/Button";
import useEventDistance from "../../event/hooks/useEventDistance";
import useDataStore from "../../../shared/store/dataStore";
import useFavorites from "../hooks/useFavorites";
import EventListingCard from "./EventListingCard";

export default function Favorites() {
  const { favorites, toggleFavorite } = useFavorites();
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const { getEventDistance } = useEventDistance();
  const activeOrganizationIds = new Set(
    organizations
      .filter((organization) => organization.is_active && !organization.deleted_at)
      .map((organization) => organization.id),
  );
  const favoriteEvents = events.filter(
    (event) =>
      favorites.includes(event.id) &&
      event.is_active &&
      !event.deleted_at &&
      activeOrganizationIds.has(event.organization_id),
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
      <div className="user-events-list__grid">
        {favoriteEvents.map((event) => (
          <EventListingCard
            key={event.id}
            event={event}
            distanceInKilometers={getEventDistance(event)}
            actions={
              <Button
                icon={<Trash2 size={18} aria-hidden="true" />}
                type="button"
                variant="danger"
                onClick={() => toggleFavorite(event.id)}
              >
                Supprimer
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
