import { ROUTES } from "../../../shared/constants/routes";
import type { Company } from "../../companies/types/company";
import type { Event } from "../../events/types/event";
import { formatDateTime } from "../../events/utils/event";
import type { Account, User } from "../../user/types/user";
import { getNotificationTypeBySlug } from "../mocks/notification-types.mock";
import type { NotificationDraft } from "../types/notification";

const getAppUrl = (path: string) => {
  if (typeof window === "undefined") return path;

  return new URL(path, window.location.origin).toString();
};

export function createFavoriteEventTodayNotification(params: {
  user: User;
  event: Event;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    company_id: params.event.company_id,
    notification_type_id: getNotificationTypeBySlug("favorite_event_today").id,
    title: "Un evenement favori a lieu aujourd'hui",
    message: `${params.event.title} a lieu aujourd'hui a ${params.event.city}. Debut: ${formatDateTime(
      params.event.start_date,
    )}.`,
    action_url: getAppUrl(ROUTES.PUBLIC.HOME),
  };
}

export function createPasswordResetNotification(params: {
  account: Account;
  user: User;
  resetUrl: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    company_id: null,
    notification_type_id: getNotificationTypeBySlug("password_reset_requested")
      .id,
    title: "Reinitialisation de votre mot de passe",
    message:
      "Une demande de reinitialisation de mot de passe a ete effectuee. Utilisez le lien ci-dessous pour choisir un nouveau mot de passe.",
    action_url: params.resetUrl,
    is_read: true,
  };
}

export function createPasswordChangedNotification(params: {
  user: User;
  profileUrl?: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    company_id: null,
    notification_type_id: getNotificationTypeBySlug("password_changed").id,
    title: "Votre mot de passe a ete modifie",
    message:
      "Votre mot de passe vient d'etre modifie. Si vous n'etes pas a l'origine de ce changement, contactez un administrateur.",
    action_url: params.profileUrl ?? null,
  };
}

export function createWelcomeNotification(params: {
  user: User;
  company?: Company | null;
}): NotificationDraft {
  const company = params.company ?? null;

  return {
    user_id: params.user.id,
    event_id: null,
    company_id: company?.id ?? null,
    notification_type_id: getNotificationTypeBySlug("welcome_email").id,
    title: "Bienvenue sur la plateforme",
    message: company
      ? `${company.name}, votre compte entreprise a bien ete cree. Il est en attente de validation par un administrateur.`
      : `${params.user.username}, votre compte a bien ete cree. Vous pouvez maintenant explorer les evenements et gerer vos favoris.`,
    action_url: getAppUrl(
      company ? ROUTES.COMPANY.DASHBOARD : ROUTES.PUBLIC.HOME,
    ),
    is_read: true,
  };
}

export function createCompanyApprovedNotification(params: {
  company: Company;
  user: User;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    company_id: params.company.id,
    notification_type_id: getNotificationTypeBySlug("company_approved").id,
    title: "Votre compte entreprise est valide",
    message: `${params.company.name} a ete validee. Vous pouvez maintenant gerer vos evenements.`,
    action_url: getAppUrl(ROUTES.COMPANY.PROFILE),
  };
}

export function createEventApprovedNotification(params: {
  company: Company;
  event: Event;
  user: User;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    company_id: params.company.id,
    notification_type_id: getNotificationTypeBySlug("event_approved").id,
    title: "Votre evenement est publie",
    message: `${params.event.title} a ete valide et publie. Il est maintenant visible par les utilisateurs.`,
    action_url: getAppUrl(ROUTES.COMPANY.EVENTS),
  };
}
