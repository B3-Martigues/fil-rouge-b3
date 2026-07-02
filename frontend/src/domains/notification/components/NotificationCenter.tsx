import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";

import useAuthStore from "../../auth/store/authStore";
import Button from "../../../shared/components/ui/Button";
import useDataStore from "../../../shared/store/dataStore";
import NotificationInbox from "./NotificationInbox";

export default function NotificationCenter() {
  const panelId = "notification-center-panel";
  const currentUser = useAuthStore((s) => s.currentUser);
  const notifications = useDataStore((s) => s.notifications);
  const [isOpen, setIsOpen] = useState(false);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const userId = currentUser?.user_id;

  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !centerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    });

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

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
  const triggerLabel =
    unreadCount > 0
      ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
      : "Notifications";

  return (
    <div className="notification-center" ref={centerRef}>
      <Button
        className="notification-center__trigger"
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-haspopup="dialog"
        icon={<Bell size={18} aria-hidden="true" />}
        size="icon"
        variant="secondary"
        onClick={() => setIsOpen((value) => !value)}
      >
        {unreadCount > 0 && (
          <span className="notification-center__count" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          className="notification-center__panel"
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
        >
          <NotificationInbox onNotificationOpen={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
