import { Trash2 } from "lucide-react";

import Button from "../../../shared/components/ui/Button";
import useDataStore from "../../../shared/store/dataStore";
import useAuthStore from "../../auth/store/authStore";
import { eventsApi } from "../../event/api/events.api";
import useEventDistance from "../../event/hooks/useEventDistance";
import type { Event } from "../../event/types/event";
import { formatDateTimeWithAt } from "../../event/utils/event";
import type { Organization } from "../../organization/types/organization";
import type { History as HistoryEntry } from "../types/history";
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

export default function History() {
  const user = useAuthStore((s) => s.currentUser);
  const histories = useDataStore((s) => s.histories);
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const removeHistoryById = useDataStore((s) => s.removeHistoryById);
  const { getEventDistance } = useEventDistance();
  const eventsById = new Map(events.map((event) => [event.id, event]));

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
      event: history.event ?? eventsById.get(history.event_id),
    }))
    .filter(({ event }) => isDisplayableAccountEvent(event, organizations))
    .sort(
      (firstItem, secondItem) =>
        new Date(secondItem.history.visited_at).getTime() -
        new Date(firstItem.history.visited_at).getTime(),
    );

  return (
    <div className="user-history">
      {userHistory.length === 0 ? (
        <p className="feedback-message feedback-message--empty">
          Aucun événement consulté pour le moment.
        </p>
      ) : (
        <div className="user-events-list__grid">
          {userHistory.map(({ history, event }) => {
            if (!event) return null;

            return (
              <EventListingCard
                key={history.id}
                event={event}
                distanceInKilometers={getEventDistance(event)}
                meta={
                  <time dateTime={history.visited_at}>
                    Consulté le {formatDateTimeWithAt(history.visited_at)}
                  </time>
                }
                actions={
                  <Button
                    icon={<Trash2 size={18} aria-hidden="true" />}
                    type="button"
                    variant="danger"
                    onClick={() => {
                      if (user?.user_id) {
                        void eventsApi.removeHistory(history.id).then((result) => {
                          if (result.ok) {
                            removeHistoryById(history.id);
                          }
                        });
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
