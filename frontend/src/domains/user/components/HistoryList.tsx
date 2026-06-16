import { Trash2 } from "lucide-react";

import Button from "../../../shared/components/ui/Button";
import useAuthStore from "../../auth/store/authStore";
import useEventDistance from "../../event/hooks/useEventDistance";
import { formatDateTime } from "../../event/utils/event";
import useDataStore from "../../../shared/store/dataStore";
import type { History as HistoryEntry } from "../types/history";
import EventListingCard from "./EventListingCard";

export default function History() {
  const user = useAuthStore((s) => s.currentUser);
  const histories = useDataStore((s) => s.histories);
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const removeHistory = useDataStore((s) => s.removeHistory);
  const { getEventDistance } = useEventDistance();
  const activeOrganizationIds = new Set(
    organizations
      .filter((organization) => organization.is_active && !organization.deleted_at)
      .map((organization) => organization.id),
  );

  const latestHistoryByEvent = histories
    .filter((history) => history.user_id === user?.user_id && !history.deleted_at)
    .reduce<Map<number, HistoryEntry>>((historyMap, history) => {
      const currentHistory = historyMap.get(history.event_id);
      const isMoreRecent =
        !currentHistory ||
        new Date(history.visited_at).getTime() >
          new Date(currentHistory.visited_at).getTime();

      if (isMoreRecent) {
        historyMap.set(history.event_id, history);
      }

      return historyMap;
    }, new Map());

  const userHistory = Array.from(latestHistoryByEvent.values())
    .map((history) => ({
      history,
      event: events.find((event) => event.id === history.event_id),
    }))
    .filter(
      (item) =>
        item.event?.is_active &&
        !item.event.deleted_at &&
        activeOrganizationIds.has(item.event.organization_id),
    )
    .sort(
      (firstItem, secondItem) =>
        new Date(secondItem.history.visited_at).getTime() -
        new Date(firstItem.history.visited_at).getTime(),
    );

  return (
    <div className="user-history">
      {userHistory.length === 0 ? (
        <p>Aucun evenement consulte pour le moment.</p>
      ) : (
        <div className="user-events-list__grid">
          {userHistory.map(({ history, event }) => {
            if (!event) return null;

            return (
              <EventListingCard
                key={event.id}
                event={event}
                distanceInKilometers={getEventDistance(event)}
                meta={
                  <time dateTime={history.visited_at}>
                    Consulte le {formatDateTime(history.visited_at)}
                  </time>
                }
                actions={
                  <Button
                    icon={<Trash2 size={18} aria-hidden="true" />}
                    type="button"
                    variant="danger"
                    onClick={() => {
                      if (user?.user_id) {
                        removeHistory(user.user_id, event.id);
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
