import type { Notification } from "../types/notification";

export type NotificationEmailRecipient = {
  email: string;
  name: string;
};

export type NotificationEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export function renderNotificationEmail(
  notification: Notification,
  recipient: NotificationEmailRecipient,
): NotificationEmail {
  const actionText = notification.action_url
    ? `\n\nLien: ${notification.action_url}`
    : "";
  const actionHtml = notification.action_url
    ? `<p><a href="${escapeHtml(notification.action_url)}">Ouvrir le lien</a></p>`
    : "";

  return {
    to: recipient.email,
    subject: notification.title,
    text: `Bonjour ${recipient.name},\n\n${notification.message}${actionText}`,
    html: `
      <main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827;">
        <h1 style="font-size: 22px;">${escapeHtml(notification.title)}</h1>
        <p>Bonjour ${escapeHtml(recipient.name)},</p>
        <p>${escapeHtml(notification.message)}</p>
        ${actionHtml}
      </main>
    `,
  };
}
