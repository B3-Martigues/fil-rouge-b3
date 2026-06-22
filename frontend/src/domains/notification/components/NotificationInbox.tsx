import { useEffect, useMemo } from "react";
import { ExternalLink, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../auth/store/authStore";
import EmptyState from "../../../shared/components/feedback/EmptyState";
import Button from "../../../shared/components/ui/Button";
import useDataStore from "../../../shared/store/dataStore";
import { getNotificationTypeConfig } from "../mocks/notification-types.mock";
import type { Notification } from "../types/notification";

type Props = {
  onNotificationOpen?: () => void;
};

export default function NotificationInbox({ onNotificationOpen }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useDataStore((s) => s.notifications);
  const notificationEmailDeliveries = useDataStore(
    (s) => s.notificationEmailDeliveries,
  );
  const markNotificationAsRead = useDataStore((s) => s.markNotificationAsRead);
  const syncTodaysFavoriteEventNotifications = useDataStore(
    (s) => s.syncTodaysFavoriteEventNotifications,
  );
  const navigate = useNavigate();
  const userId = currentUser?.user_id;

  useEffect(() => {
    if (userId) {
      syncTodaysFavoriteEventNotifications(userId);
    }
  }, [syncTodaysFavoriteEventNotifications, userId]);

  const inAppNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => {
          const notificationTypeConfig = getNotificationTypeConfig(
            notification.notification_type_id,
          );

          return (
            notification.user_id === userId &&
            notificationTypeConfig?.channels.includes("in_app")
          );
        })
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime(),
        ),
    [notifications, userId],
  );
  const emailNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => {
          const notificationTypeConfig = getNotificationTypeConfig(
            notification.notification_type_id,
          );

          return (
            notification.user_id === userId &&
            notificationTypeConfig?.channels.includes("email")
          );
        })
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime(),
        ),
    [notifications, userId],
  );

  const getInternalActionPath = (actionUrl?: string | null) => {
    if (!actionUrl) return null;

    try {
      const url = new URL(actionUrl, window.location.origin);

      if (url.origin !== window.location.origin) return null;

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  };

  const openNotification = (notification: Notification) => {
    markNotificationAsRead(notification.id);

    const actionPath = getInternalActionPath(notification.action_url);

    if (!actionPath) return;

    onNotificationOpen?.();
    navigate(actionPath);
  };

  return (
    <>
      {inAppNotifications.length === 0 ? (
        <EmptyState message="Aucune notification." />
      ) : (
        <ul aria-label="Liste des notifications">
          {inAppNotifications.map((notification) => (
            <li
              className={notification.is_read ? "" : "is-unread"}
              key={notification.id}
            >
              <Button
                className="notification-center__item"
                type="button"
                fullWidth
                variant="ghost"
                aria-label={`${notification.title}. ${
                  notification.is_read ? "Lue" : "Non lue"
                }. ${
                  notification.action_url
                    ? "Ouvrir la notification"
                    : "Marquer comme lue"
                }`}
                onClick={() => openNotification(notification)}
              >
                <strong>{notification.title}</strong>
                <span className="notification-center__message">
                  {notification.message}
                </span>
                {getNotificationTypeConfig(
                  notification.notification_type_id,
                )?.channels.includes("email") && (
                  <small>
                    <Mail size={13} aria-hidden="true" />
                    email
                  </small>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {emailNotifications.length > 0 && (
        <details className="notification-center__outbox">
          <summary>Emails envoyes</summary>
          <ul>
            {emailNotifications.map((notification) => {
              const delivery = notificationEmailDeliveries.find(
                (item) => item.notification_id === notification.id,
              );

              return (
                <li key={`email-${notification.id}`}>
                  <span>
                    <Mail size={13} aria-hidden="true" />
                    {notification.title}
                  </span>
                  <small>
                    {delivery?.provider ?? "email"} -{" "}
                    {delivery?.status ?? "queued"}
                  </small>
                  {delivery?.preview_url && (
                    <a
                      href={delivery.preview_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      Apercu
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
