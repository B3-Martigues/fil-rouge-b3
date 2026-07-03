import { Trash2 } from "lucide-react";

import Button from "../../../shared/components/ui/Button";
import useDataStore from "../../../shared/store/dataStore";
import useEventDistance from "../../event/hooks/useEventDistance";
import type { Event } from "../../event/types/event";
import { formatDateTimeWithAt } from "../../event/utils/event";
import type { Organization } from "../../organization/types/organization";
import useFavorites from "../hooks/useFavorites";
import EventListingCard from "./EventListingCard";

const isDisplayableAccountEvent = (
  event: Event | undefined,
  organizations: Organization[],
) => {
  if (!event || !event.is_active || event.deleted_at) return false;

  const organization =
    organizations.find((item) => item.id === event.organization_id) ??
    event.organization;

  if (!organization) return true;

  return (
    organization.is_active &&
    !("deleted_at" in organization && organization.deleted_at)
  );
};

export default function Favorites() {
  const { favoriteEntries, toggleFavorite } = useFavorites();
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const { getEventDistance } = useEventDistance();
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const favoriteItems = favoriteEntries
    .map((favorite) => ({
      favorite,
      event: favorite.event ?? eventsById.get(favorite.event_id),
    }))
    .filter(({ event }) => isDisplayableAccountEvent(event, organizations))
    .sort(
      (firstItem, secondItem) =>
        new Date(secondItem.favorite.created_at ?? 0).getTime() -
        new Date(firstItem.favorite.created_at ?? 0).getTime(),
    );

  if (favoriteItems.length === 0) {
    return (
      <p className="feedback-message feedback-message--empty">
        Aucun événement en favoris
      </p>
    );
  }

  return (
    <div className="user-favorites">
      <div className="user-events-list__grid">
        {favoriteItems.map(({ favorite, event }) => {
          if (!event) return null;

          return (
            <EventListingCard
              key={favorite.id}
              event={event}
              distanceInKilometers={getEventDistance(event)}
              meta={
                favorite.created_at ? (
                  <time dateTime={favorite.created_at}>
                    Ajouté le {formatDateTimeWithAt(favorite.created_at)}
                  </time>
                ) : undefined
              }
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
          );
        })}
      </div>
    </div>
  );
}
