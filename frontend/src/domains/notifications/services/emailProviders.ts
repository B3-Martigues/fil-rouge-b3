import type {
  Notification,
} from "../types/notification";
import {
  renderNotificationEmail,
  type NotificationEmailRecipient,
} from "./emailTemplates";

type EmailProviderName = "ethereal" | "resend";
export type EmailDeliveryResult = {
  status: "sent" | "failed";
  provider?: EmailProviderName;
  message_id?: string;
  preview_url?: string;
  sent_at: string;
  error?: string;
};

const isEmailProviderName = (value: string): value is EmailProviderName =>
  value === "ethereal" || value === "resend";

const getConfiguredEmailProvider = (): EmailProviderName => {
  const provider = import.meta.env.VITE_EMAIL_PROVIDER;

  if (typeof provider === "string" && isEmailProviderName(provider)) {
    return provider;
  }

  return "ethereal";
};

const createMessageId = (provider: EmailProviderName, notificationId: string) =>
  `${provider}_${notificationId.replace(/[^a-zA-Z0-9]/g, "")}`;

async function sendWithEthereal(params: {
  notification: Notification;
  recipient: NotificationEmailRecipient;
}): Promise<EmailDeliveryResult> {
  renderNotificationEmail(params.notification, params.recipient);

  await new Promise((resolve) => setTimeout(resolve, 250));

  return {
    status: "sent",
    provider: "ethereal",
    message_id: createMessageId("ethereal", String(params.notification.id)),
    preview_url: `https://ethereal.email/message/${encodeURIComponent(
      String(params.notification.id),
    )}`,
    sent_at: new Date().toISOString(),
  };
}

async function sendWithResend(params: {
  notification: Notification;
  recipient: NotificationEmailRecipient;
}): Promise<EmailDeliveryResult> {
  renderNotificationEmail(params.notification, params.recipient);

  return {
    status: "failed",
    provider: "resend",
    message_id: createMessageId("resend", String(params.notification.id)),
    sent_at: new Date().toISOString(),
    error: "Resend doit etre appele depuis un backend ou une route API serveur.",
  };
}

export async function sendNotificationEmail(params: {
  notification: Notification;
  recipient: NotificationEmailRecipient;
}): Promise<EmailDeliveryResult> {
  const provider = getConfiguredEmailProvider();

  if (provider === "resend") {
    return sendWithResend(params);
  }

  return sendWithEthereal(params);
}
