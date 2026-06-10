import { ROUTES } from "../../../shared/constants/routes";
import type { Organization } from "../../organizations/types/organization";
import type { Event } from "../../events/types/event";
import { formatDateTime } from "../../events/utils/event";
import type { Account, User } from "../../user/types/user";
import { getNotificationTypeBySlug } from "../mocks/notification-types.mock";
import type { NotificationDraft } from "../types/notification";

const getAppUrl = (path: string) => {
  if (typeof window === "undefined") return path;

  return new URL(path, window.location.origin).toString();
};

const getOrganizationManagementPath = (
  organization: Organization,
  user: User,
  legacyOrganizationPath: string = ROUTES.ORGANIZATION.PROFILE,
) =>
  user.role === "organization"
    ? legacyOrganizationPath
    : ROUTES.USER.ORGANIZATION_DETAIL.replace(
        ":organizationId",
        String(organization.id),
      );

const withReason = (message: string, reason: string) =>
  `${message} Raison: ${reason.trim()}`;

const withModeratorMessage = (message: string, moderatorMessage: string) =>
  `${message} Message du moderateur: ${moderatorMessage.trim()}`;

export function createFavoriteEventTodayNotification(params: {
  user: User;
  event: Event;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.event.organization_id,
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
    organization_id: null,
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
    organization_id: null,
    notification_type_id: getNotificationTypeBySlug("password_changed").id,
    title: "Votre mot de passe a ete modifie",
    message:
      "Votre mot de passe vient d'etre modifie. Si vous n'etes pas a l'origine de ce changement, contactez un administrateur.",
    action_url: params.profileUrl ?? null,
  };
}

export function createWelcomeNotification(params: {
  user: User;
  organization?: Organization | null;
}): NotificationDraft {
  const organization = params.organization ?? null;

  return {
    user_id: params.user.id,
    event_id: null,
    organization_id: organization?.id ?? null,
    notification_type_id: getNotificationTypeBySlug("welcome_email").id,
    title: "Bienvenue sur la plateforme",
    message: organization
      ? `${organization.name}, votre compte organization a bien ete cree. Il est en attente de validation par un administrateur.`
      : `${params.user.username}, votre compte a bien ete cree. Vous pouvez maintenant explorer les événements et gerer vos favoris.`,
    action_url: getAppUrl(
      organization
        ? getOrganizationManagementPath(organization, params.user)
        : ROUTES.PUBLIC.HOME,
    ),
    is_read: true,
  };
}

export function createOrganizationApprovedNotification(params: {
  organization: Organization;
  user: User;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("organization_approved").id,
    title: "Votre compte organization est valide",
    message: `${params.organization.name} a ete validee. Vous pouvez maintenant gerer vos événements.`,
    action_url: getAppUrl(
      getOrganizationManagementPath(params.organization, params.user),
    ),
  };
}

export function createOrganizationRejectedNotification(params: {
  organization: Organization;
  user: User;
  reason: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("organization_rejected").id,
    title: "Votre compte organization est refuse",
    message: withReason(
      `${params.organization.name} n'a pas ete validee par la moderation.`,
      params.reason,
    ),
    action_url: getAppUrl(
      getOrganizationManagementPath(params.organization, params.user),
    ),
  };
}

export function createEventApprovedNotification(params: {
  organization: Organization;
  event: Event;
  user: User;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("event_approved").id,
    title: "Votre evenement est publie",
    message: `${params.event.title} a ete valide et publie. Il est maintenant visible par les utilisateurs.`,
    action_url: getAppUrl(
      getOrganizationManagementPath(
        params.organization,
        params.user,
        ROUTES.ORGANIZATION.EVENTS,
      ),
    ),
  };
}

export function createEventRejectedNotification(params: {
  organization: Organization;
  event: Event;
  user: User;
  reason: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("event_rejected").id,
    title: "Votre evenement est refuse",
    message: withReason(
      `${params.event.title} ne peut pas etre publie en l'etat.`,
      params.reason,
    ),
    action_url: getAppUrl(
      getOrganizationManagementPath(
        params.organization,
        params.user,
        ROUTES.ORGANIZATION.EVENTS,
      ),
    ),
  };
}

export function createEventHiddenNotification(params: {
  organization: Organization;
  event: Event;
  user: User;
  reason: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("event_hidden").id,
    title: "Votre evenement a ete masque",
    message: withReason(
      `${params.event.title} n'est plus visible publiquement.`,
      params.reason,
    ),
    action_url: getAppUrl(
      getOrganizationManagementPath(
        params.organization,
        params.user,
        ROUTES.ORGANIZATION.EVENTS,
      ),
    ),
  };
}

export function createEventDeletedNotification(params: {
  organization: Organization;
  event: Event;
  user: User;
  reason: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("event_deleted").id,
    title: "Votre evenement a ete supprime",
    message: withReason(
      `${params.event.title} a ete retire par la moderation.`,
      params.reason,
    ),
    action_url: getAppUrl(
      getOrganizationManagementPath(
        params.organization,
        params.user,
        ROUTES.ORGANIZATION.EVENTS,
      ),
    ),
  };
}

export function createAccountSuspendedNotification(params: {
  user: User;
  organization?: Organization | null;
  reason: string;
  suspendedUntil: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: null,
    organization_id: params.organization?.id ?? null,
    notification_type_id: getNotificationTypeBySlug("account_suspended").id,
    title: "Votre compte est temporairement suspendu",
    message: withReason(
      `Votre compte est suspendu jusqu'au ${new Date(
        params.suspendedUntil,
      ).toLocaleDateString("fr-FR")}.`,
      params.reason,
    ),
    action_url: null,
  };
}

export function createReportUsefulNotification(params: {
  user: User;
  targetLabel: string;
  moderatorMessage: string;
  event?: Event | null;
  organization?: Organization | null;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event?.id ?? null,
    organization_id: params.organization?.id ?? params.event?.organization_id ?? null,
    notification_type_id: getNotificationTypeBySlug("moderation_decision").id,
    title: "Votre signalement a ete utile",
    message: withModeratorMessage(
      `Merci ${params.user.username}, votre signalement concernant ${params.targetLabel} a aide la moderation a prendre une decision.`,
      params.moderatorMessage,
    ),
    action_url: getAppUrl(ROUTES.PUBLIC.HOME),
  };
}

export function createEventWithdrawnAfterReportNotification(params: {
  organization: Organization;
  event: Event;
  user: User;
  moderatorMessage: string;
}): NotificationDraft {
  return {
    user_id: params.user.id,
    event_id: params.event.id,
    organization_id: params.organization.id,
    notification_type_id: getNotificationTypeBySlug("moderation_decision").id,
    title: "Decision moderation: evenement retire",
    message: withModeratorMessage(
      `${params.event.title} a ete retire de la plateforme suite au traitement d'un signalement.`,
      params.moderatorMessage,
    ),
    action_url: getAppUrl(
      getOrganizationManagementPath(
        params.organization,
        params.user,
        ROUTES.ORGANIZATION.EVENTS,
      ),
    ),
  };
}
