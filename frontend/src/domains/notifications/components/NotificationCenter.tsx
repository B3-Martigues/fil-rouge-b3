import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ExternalLink, Mail } from "lucide-react";

import useAuthStore from "../../auth/store/authStore";
import { getNotificationTypeConfig } from "../mocks/notification-types.mock";
import useDataStore from "../../../shared/store/dataStore";

export default function NotificationCenter() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useDataStore((s) => s.notifications);
  const notificationEmailDeliveries = useDataStore(
    (s) => s.notificationEmailDeliveries,
  );
  const markNotificationAsRead = useDataStore((s) => s.markNotificationAsRead);
  const markUserNotificationsAsRead = useDataStore(
    (s) => s.markUserNotificationsAsRead,
  );
  const syncTodaysFavoriteEventNotifications = useDataStore(
    (s) => s.syncTodaysFavoriteEventNotifications,
  );
  const [isOpen, setIsOpen] = useState(false);
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
  const unreadCount = inAppNotifications.filter(
    (notification) => !notification.is_read,
  ).length;
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

  return (
    <div className="notification-center">
      <button
        className="notification-center__trigger"
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-center__panel">
          <div className="notification-center__header">
            <strong>Notifications</strong>
            {inAppNotifications.length > 0 && userId && (
              <button
                type="button"
                title="Marquer comme lu"
                onClick={() => markUserNotificationsAsRead(userId)}
              >
                <CheckCheck size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {inAppNotifications.length === 0 ? (
            <p>Aucune notification.</p>
          ) : (
            <ul>
              {inAppNotifications.map((notification) => (
                <li
                  className={notification.is_read ? "" : "is-unread"}
                  key={notification.id}
                >
                  <button
                    type="button"
                    onClick={() => markNotificationAsRead(notification.id)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    {getNotificationTypeConfig(
                      notification.notification_type_id,
                    )?.channels.includes("email") && (
                      <small>
                        <Mail size={13} aria-hidden="true" />
                        email
                      </small>
                    )}
                  </button>
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
        </div>
      )}
    </div>
  );
}
