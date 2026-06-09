import type {
  NotificationType,
  NotificationTypeConfig,
  NotificationTypeSlug,
} from "../types/notification";

export const notificationTypesMock: NotificationType[] = [
  {
    id: 1,
    name: "Evenement favori aujourd'hui",
    slug: "favorite_event_today",
  },
  {
    id: 2,
    name: "Reinitialisation de mot de passe",
    slug: "password_reset_requested",
  },
  {
    id: 3,
    name: "Mot de passe modifie",
    slug: "password_changed",
  },
  {
    id: 4,
    name: "Compte entreprise valide",
    slug: "company_approved",
  },
  {
    id: 5,
    name: "Evenement valide",
    slug: "event_approved",
  },
  {
    id: 6,
    name: "Email de bienvenue",
    slug: "welcome_email",
  },
  {
    id: 7,
    name: "Compte entreprise refuse",
    slug: "company_rejected",
  },
  {
    id: 8,
    name: "Evenement refuse",
    slug: "event_rejected",
  },
  {
    id: 9,
    name: "Evenement masque",
    slug: "event_hidden",
  },
  {
    id: 10,
    name: "Evenement supprime",
    slug: "event_deleted",
  },
  {
    id: 11,
    name: "Compte suspendu",
    slug: "account_suspended",
  },
  {
    id: 12,
    name: "Decision moderation",
    slug: "moderation_decision",
  },
];

export const notificationTypeConfigs: NotificationTypeConfig[] = [
  {
    ...notificationTypesMock[0],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[1],
    channels: ["email"],
  },
  {
    ...notificationTypesMock[2],
    channels: ["in_app"],
  },
  {
    ...notificationTypesMock[3],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[4],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[5],
    channels: ["email"],
  },
  {
    ...notificationTypesMock[6],
    channels: ["in_app"],
  },
  {
    ...notificationTypesMock[7],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[8],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[9],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[10],
    channels: ["in_app", "email"],
  },
  {
    ...notificationTypesMock[11],
    channels: ["in_app", "email"],
  },
];

export const getNotificationTypeBySlug = (slug: NotificationTypeSlug) => {
  const notificationType = notificationTypesMock.find(
    (item) => item.slug === slug,
  );

  if (!notificationType) {
    throw new Error(`Notification type introuvable: ${slug}`);
  }

  return notificationType;
};

export const getNotificationTypeConfig = (notificationTypeId: number) =>
  notificationTypeConfigs.find((item) => item.id === notificationTypeId);
