import useAuthStore from "../../auth/store/authStore";
import {
  formatDateTime,
  formatEventDateRange,
  formatEventPrice,
  getTicketingHref,
} from "../../event/utils/event";
import useDataStore from "../../../shared/store/dataStore";
import type { History as HistoryEntry } from "../types/history";

export default function History() {
  const user = useAuthStore((s) => s.currentUser);
  const histories = useDataStore((s) => s.histories);
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
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
    <div>
      <h1>Mon historique</h1>

      {userHistory.length === 0 ? (
        <p>Aucun événement consulté pour le moment.</p>
      ) : (
        <div className="events-list__grid">
          {userHistory.map(({ history, event }) =>
            event ? (
              <article className="event-card" key={event.id}>
                <img
                  className="event-card__image"
                  src={event.image}
                  alt=""
                  loading="lazy"
                />
                <div className="event-card__content">
                  <div className="event-card__meta">
                    <span>{event.category_slugs.join(", ")}</span>
                    <time dateTime={history.visited_at}>
                      Consulte le {formatDateTime(history.visited_at)}
                    </time>
                  </div>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <dl className="event-card__details">
                    <div>
                      <dt>Debut / fin</dt>
                      <dd>{formatEventDateRange(event)}</dd>
                    </div>
                    <div>
                      <dt>Ville</dt>
                      <dd>{event.city}</dd>
                    </div>
                    <div>
                      <dt>Prix</dt>
                      <dd>{formatEventPrice(event.price)}</dd>
                    </div>
                  </dl>
                  {getTicketingHref(event.ticketing_link) && (
                    <a
                      className="btn btn--secondary event-card__ticketing-link"
                      href={getTicketingHref(event.ticketing_link) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Billetterie
                    </a>
                  )}
                </div>
              </article>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
