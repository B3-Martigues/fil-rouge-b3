import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../auth/store/authStore";
import EmptyState from "../../../shared/components/feedback/EmptyState";
import Button from "../../../shared/components/ui/Button";
import useDataStore from "../../../shared/store/dataStore";
import type { Notification } from "../types/notification";
import { userApi } from "../../user/api/user.api";

type Props = {
  onNotificationOpen?: () => void;
};

export default function NotificationInbox({ onNotificationOpen }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useDataStore((s) => s.notifications);
  const notificationTypes = useDataStore((s) => s.notificationTypes);
  const upsertNotification = useDataStore((s) => s.upsertNotification);
  const markUserNotificationsAsRead = useDataStore(
    (s) => s.markUserNotificationsAsRead,
  );
  const navigate = useNavigate();
  const userId = currentUser?.user_id;

  const inAppNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => notification.user_id === userId)
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
    void userApi.markNotificationRead(notification.id).then((result) => {
      if (result.ok) {
        upsertNotification(result.data);
      }
    });

    const actionPath = getInternalActionPath(notification.action_url);

    if (!actionPath) return;

    onNotificationOpen?.();
    navigate(actionPath);
  };

  const markAllAsRead = () => {
    if (!userId || unreadCount === 0) return;

    void userApi.markAllNotificationsRead().then((result) => {
      if (result.ok) {
        markUserNotificationsAsRead(userId);
      }
    });
  };

  return (
    <>
      {inAppNotifications.length === 0 ? (
        <EmptyState message="Aucune notification." />
      ) : (
        <>
          <div className="notification-center__toolbar">
            <span>
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={unreadCount === 0}
              onClick={markAllAsRead}
            >
              Tout marquer comme lu
            </Button>
          </div>
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
                  <small>
                    {notificationTypes.find(
                      (type) => type.id === notification.notification_type_id,
                    )?.name ?? "Notification"}
                  </small>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
