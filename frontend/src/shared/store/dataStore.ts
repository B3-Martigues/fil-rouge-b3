import { create } from "zustand";
import { persist } from "zustand/middleware";

import { accountsMock } from "../../domains/auth/mocks/accounts.mock";
import type { PasswordResetToken } from "../../domains/auth/types/passwordReset";
import { organizersMock } from "../../domains/organizations/mocks/organizers.mock";
import { organizationsMock } from "../../domains/organizations/mocks/organizations.mock";
import type { Organization } from "../../domains/organizations/types/organization";
import type { Organizer } from "../../domains/organizations/types/organizer";
import { eventsMock } from "../../domains/events/mocks/events.mock";
import type { Event } from "../../domains/events/types/event";
import {
  moderationDecisionsMock,
  moderationReportsMock,
} from "../../domains/moderator/mocks/moderation.mock";
import type {
  ModerationDecision,
  ModerationReport,
  ModerationReportPriority,
  ModerationTargetType,
} from "../../domains/moderator/types/moderation";
import { notificationTypesMock } from "../../domains/notifications/mocks/notification-types.mock";
import { getNotificationTypeConfig } from "../../domains/notifications/mocks/notification-types.mock";
import {
  sendNotificationEmail,
  type EmailDeliveryResult,
} from "../../domains/notifications/services/emailProviders";
import {
  createFavoriteEventTodayNotification,
  createPasswordChangedNotification,
  createPasswordResetNotification as buildPasswordResetNotification,
} from "../../domains/notifications/services/notificationFactory";
import type {
  Notification,
  NotificationDraft,
  NotificationType,
} from "../../domains/notifications/types/notification";
import { favoritesMock } from "../../domains/user/mocks/favorites.mock";
import { historiesMock } from "../../domains/user/mocks/history.mock";
import {
  userEventPreferencesMock,
  usersMock,
} from "../../domains/user/mocks/users.mock";
import type { Favorite } from "../../domains/user/types/favorite";
import type { History } from "../../domains/user/types/history";
import type {
  Account,
  AccountSummary,
  User,
  UserEventPreference,
} from "../../domains/user/types/user";
import { ROLE_IDS } from "../../domains/user/types/user";
import {
  getEventCategoryId,
  type EventCategoryName,
} from "../../domains/events/types/event-categories";

type PasswordResetResult = {
  ok: boolean;
  message: string;
  resetLink?: string;
};

type NotificationEmailDelivery = EmailDeliveryResult & {
  notification_id: number;
};

type AddModerationReportPayload = {
  target_type: ModerationTargetType;
  target_id: number;
  reporter_user_id: number;
  reason: string;
  details: string;
  priority?: ModerationReportPriority;
};

type DataState = {
  accounts: Account[];
  users: User[];
  organizations: Organization[];
  organizers: Organizer[];
  events: Event[];
  favorites: Favorite[];
  histories: History[];
  userEventPreferences: UserEventPreference[];
  notificationTypes: NotificationType[];
  notifications: Notification[];
  notificationEmailDeliveries: NotificationEmailDelivery[];
  moderationReports: ModerationReport[];
  moderationDecisions: ModerationDecision[];
  passwordResetTokens: PasswordResetToken[];

  getAccountSummaries: () => AccountSummary[];

  dispatchNotification: (
    notification: NotificationDraft,
  ) => Promise<Notification | null>;
  markNotificationAsRead: (notificationId: number) => void;
  markUserNotificationsAsRead: (userId: number) => void;
  syncTodaysFavoriteEventNotifications: (userId: number) => void;
  createPasswordResetNotification: (email: string) => PasswordResetResult;
  resetPasswordWithToken: (
    token: string,
    newPassword: string,
  ) => { ok: boolean; message: string };

  addAccount: (account: Account) => void;
  updateAccount: (accountId: number, data: Partial<Account>) => void;
  deleteAccount: (accountId: number) => void;

  addUser: (user: User) => void;
  updateUser: (userId: number, data: Partial<User>) => void;
  deleteUser: (userId: number) => void;

  addOrganization: (organization: Organization) => void;
  updateOrganization: (organizationId: number, data: Partial<Organization>) => void;
  activateOrganization: (organizationId: number) => void;
  deleteOrganization: (organizationId: number) => void;

  addOrganizer: (organizer: Organizer) => void;

  addEvent: (event: Event) => void;
  updateEvent: (
    eventId: number,
    data: Partial<Omit<Event, "id" | "created_at">>,
  ) => void;
  approveEvent: (eventId: number) => void;
  suspendEvent: (
    eventId: number,
    reason: string,
    suspendedUntil: string,
  ) => void;
  liftEventSuspension: (eventId: number) => void;
  deleteEvent: (eventId: number) => void;
  restoreEvent: (eventId: number) => void;
  deleteEventPermanently: (eventId: number) => void;

  addModerationDecision: (
    decision: Omit<ModerationDecision, "id" | "created_at"> &
      Partial<Pick<ModerationDecision, "created_at">>,
  ) => void;
  addModerationReport: (
    report: AddModerationReportPayload,
  ) => ModerationReport | null;
  updateModerationReport: (
    reportId: number,
    data: Partial<Omit<ModerationReport, "id" | "created_at">>,
  ) => void;
  suspendAccount: (
    accountId: number,
    reason: string,
    suspendedUntil: string,
  ) => void;

  toggleFavorite: (userId: number, eventId: number) => void;
  recordHistory: (userId: number, eventId: number) => void;
  setUserEventPreferences: (
    userId: number,
    categories: EventCategoryName[],
  ) => void;
};

const now = () => new Date().toISOString();

const isNotDeleted = (record: { deleted_at?: string | null }) =>
  !record.deleted_at;

const createSoftDeletePatch = () => ({
  deleted_at: now(),
  updated_at: now(),
});

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const createToken = () =>
  `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

const getLocalDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;

const getDayRange = (date: Date) => {
  const start = new Date(date);
  const end = new Date(date);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const isEventHappeningOnDay = (event: Event, date: Date) => {
  const { start, end } = getDayRange(date);
  const eventStart = new Date(event.start_date);
  const eventEnd = new Date(event.end_date);

  return eventStart <= end && eventEnd >= start;
};

const buildResetLink = (token: string) => {
  const path = `/reset-password/${token}`;

  if (typeof window === "undefined") return path;

  return new URL(path, window.location.origin).toString();
};

const buildProfileUrl = (
  accountId: number,
  organizations: Organization[],
): string | undefined => {
  const path = organizations.some(
    (organization) => organization.account_id === accountId && !organization.deleted_at,
  )
    ? "/organization/profile"
    : "/profile";

  if (typeof window === "undefined") return path;

  return new URL(path, window.location.origin).toString();
};

const isDuplicateNotification = (
  notifications: Notification[],
  draft: NotificationDraft,
) => {
  const notificationTypeConfig = getNotificationTypeConfig(
    draft.notification_type_id,
  );

  if (!notificationTypeConfig) return false;

  return notifications.some((notification) => {
    if (
      notification.user_id !== draft.user_id ||
      notification.notification_type_id !== draft.notification_type_id
    ) {
      return false;
    }

    if (notificationTypeConfig.slug === "favorite_event_today") {
      return (
        notification.event_id === draft.event_id &&
        getLocalDayKey(new Date(notification.created_at)) ===
          getLocalDayKey(new Date())
      );
    }

    if (notificationTypeConfig.slug === "organization_approved") {
      return notification.organization_id === draft.organization_id;
    }

    if (notificationTypeConfig.slug === "event_approved") {
      return (
        notification.organization_id === draft.organization_id &&
        notification.event_id === draft.event_id
      );
    }

    return false;
  });
};

const getNotificationRecipient = (
  notification: Notification,
  accounts: Account[],
  users: User[],
  organizations: Organization[],
) => {
  const user = users.find(
    (item) => item.id === notification.user_id && !item.deleted_at,
  );
  const account = user
    ? accounts.find((item) => item.id === user.account_id && !item.deleted_at)
    : undefined;
  const organization = notification.organization_id
    ? organizations.find(
        (item) => item.id === notification.organization_id && !item.deleted_at,
      )
    : undefined;

  if (!user || !account) return null;

  return {
    email: organization?.contact_email || account.login_email,
    name: organization?.name ?? user.username,
  };
};

export const buildAccountSummaries = (
  accounts: Account[],
  users: User[],
  organizations: Organization[],
): AccountSummary[] =>
  accounts.filter(isNotDeleted).map((account) => {
    const user = users.find(
      (item) => item.account_id === account.id && isNotDeleted(item),
    );
    const organization =
      account.account_type === "organization"
        ? organizations.find(
            (item) => item.account_id === account.id && isNotDeleted(item),
          )
        : undefined;

    if (organization) {
      return {
        account_id: account.id,
        login_email: account.login_email,
        password_hash: account.password_hash,
        role: "organization",
        role_id: organization.role_id ?? ROLE_IDS.organization,
        display_name: organization.name,
        is_active: account.is_active && organization.is_active,
        suspended_until: account.suspended_until ?? null,
        suspension_reason: account.suspension_reason ?? null,
        user_id: user?.id,
        organization_id: organization.id,
        is_verified: organization.is_verified,
      };
    }

    const accountRole = user?.role ?? account.account_type;

    return {
      account_id: account.id,
      login_email: account.login_email,
      password_hash: account.password_hash,
      role: accountRole,
      role_id: user?.role_id ?? ROLE_IDS[accountRole],
      display_name: user?.username ?? account.login_email,
      is_active: account.is_active,
      suspended_until: account.suspended_until ?? null,
      suspension_reason: account.suspension_reason ?? null,
      user_id: user?.id,
    };
  });

const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      accounts: accountsMock,
      users: usersMock,
      organizations: organizationsMock,
      organizers: organizersMock,
      events: eventsMock,
      favorites: favoritesMock,
      histories: historiesMock,
      userEventPreferences: userEventPreferencesMock,
      notificationTypes: notificationTypesMock,
      notifications: [],
      notificationEmailDeliveries: [],
      moderationReports: moderationReportsMock,
      moderationDecisions: moderationDecisionsMock,
      passwordResetTokens: [],

      getAccountSummaries: () =>
        buildAccountSummaries(get().accounts, get().users, get().organizations),

      dispatchNotification: async (draft) => {
        if (isDuplicateNotification(get().notifications, draft)) {
          return null;
        }

        const notification: Notification = {
          id: createNextId(get().notifications),
          user_id: draft.user_id,
          event_id: draft.event_id ?? null,
          organization_id: draft.organization_id ?? null,
          notification_type_id: draft.notification_type_id,
          title: draft.title,
          message: draft.message,
          is_read: draft.is_read ?? false,
          read_at: draft.read_at ?? null,
          action_url: draft.action_url ?? null,
          created_at: now(),
        };

        set((state) => ({
          notifications: [notification, ...state.notifications],
        }));

        const notificationTypeConfig = getNotificationTypeConfig(
          notification.notification_type_id,
        );

        if (!notificationTypeConfig?.channels.includes("email")) {
          return notification;
        }

        const recipient = getNotificationRecipient(
          notification,
          get().accounts,
          get().users,
          get().organizations,
        );

        if (!recipient) {
          return notification;
        }

        try {
          const delivery = await sendNotificationEmail({
            notification,
            recipient,
          });

          set((state) => ({
            notificationEmailDeliveries: [
              {
                ...delivery,
                notification_id: notification.id,
              },
              ...state.notificationEmailDeliveries.filter(
                (item) => item.notification_id !== notification.id,
              ),
            ],
          }));
        } catch (error) {
          const delivery: NotificationEmailDelivery = {
            notification_id: notification.id,
            status: "failed",
            sent_at: now(),
            error:
              error instanceof Error ? error.message : "Erreur d'envoi email",
          };

          set((state) => ({
            notificationEmailDeliveries: [
              delivery,
              ...state.notificationEmailDeliveries.filter(
                (item) => item.notification_id !== notification.id,
              ),
            ],
          }));
        }

        return notification;
      },

      markNotificationAsRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === notificationId
              ? {
                  ...notification,
                  is_read: true,
                  read_at: notification.read_at ?? now(),
                }
              : notification,
          ),
        })),

      markUserNotificationsAsRead: (userId) =>
        set((state) => ({
          notifications: state.notifications.map((notification) => {
            const notificationTypeConfig = getNotificationTypeConfig(
              notification.notification_type_id,
            );

            return notification.user_id === userId &&
              notificationTypeConfig?.channels.includes("in_app")
              ? {
                  ...notification,
                  is_read: true,
                  read_at: notification.read_at ?? now(),
                }
              : notification;
          }),
        })),

      syncTodaysFavoriteEventNotifications: (userId) => {
        const state = get();
        const user = state.users.find(
          (item) =>
            item.id === userId && item.role === "user" && !item.deleted_at,
        );

        if (!user) return;

        state.favorites
          .filter(
            (favorite) => favorite.user_id === user.id && !favorite.deleted_at,
          )
          .forEach((favorite) => {
            const event = state.events.find(
              (item) =>
                item.id === favorite.event_id &&
                item.is_active &&
                !item.deleted_at &&
                isEventHappeningOnDay(item, new Date()),
            );

            if (!event) return;

            void state.dispatchNotification(
              createFavoriteEventTodayNotification({
                user,
                event,
              }),
            );
          });
      },

      createPasswordResetNotification: (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        const state = get();
        const account = state.accounts.find(
          (item) =>
            item.login_email.trim().toLowerCase() === normalizedEmail &&
            item.is_active &&
            !item.deleted_at,
        );
        const successMessage =
          "Si un compte actif existe avec cet email, un lien de reinitialisation a ete envoye.";

        if (!account) {
          return {
            ok: true,
            message: successMessage,
          };
        }

        const user = state.users.find(
          (item) => item.account_id === account.id && !item.deleted_at,
        );

        if (!user) {
          return {
            ok: true,
            message: successMessage,
          };
        }

        const token = createToken();
        const createdAt = now();
        const expiresAt = addMinutes(new Date(), 30).toISOString();
        const resetLink = buildResetLink(token);

        set((currentState) => ({
          passwordResetTokens: [
            ...currentState.passwordResetTokens,
            {
              token,
              account_id: account.id,
              expires_at: expiresAt,
              used_at: null,
              created_at: createdAt,
            },
          ],
        }));

        void get().dispatchNotification(
          buildPasswordResetNotification({
            account,
            user,
            resetUrl: resetLink,
          }),
        );

        return {
          ok: true,
          message: successMessage,
          resetLink,
        };
      },

      resetPasswordWithToken: (token, newPassword) => {
        const state = get();
        const resetToken = state.passwordResetTokens.find(
          (item) => item.token === token,
        );

        if (!resetToken || resetToken.used_at) {
          return { ok: false, message: "Lien de reinitialisation invalide" };
        }

        if (new Date(resetToken.expires_at).getTime() < Date.now()) {
          return { ok: false, message: "Lien de reinitialisation expire" };
        }

        const account = state.accounts.find(
          (item) => item.id === resetToken.account_id && !item.deleted_at,
        );
        const user = state.users.find(
          (item) =>
            item.account_id === resetToken.account_id && !item.deleted_at,
        );

        if (!account || !user) {
          return { ok: false, message: "Compte introuvable" };
        }

        const passwordChangedAt = now();
        const updatedAccount = {
          ...account,
          password_hash: newPassword,
          password_changed_at: passwordChangedAt,
          updated_at: passwordChangedAt,
        };

        set((currentState) => ({
          accounts: currentState.accounts.map((item) =>
            item.id === resetToken.account_id ? updatedAccount : item,
          ),
          passwordResetTokens: currentState.passwordResetTokens.map((item) =>
            item.token === token
              ? { ...item, used_at: passwordChangedAt }
              : item,
          ),
        }));

        void get().dispatchNotification(
          createPasswordChangedNotification({
            user,
            profileUrl: buildProfileUrl(account.id, state.organizations),
          }),
        );

        return { ok: true, message: "Mot de passe mis a jour" };
      },

      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
        })),

      updateAccount: (accountId, data) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? { ...account, ...data, updated_at: now() }
              : account,
          ),
        })),

      deleteAccount: (accountId) =>
        set((state) => {
          const deletedUserIds = state.users
            .filter((user) => user.account_id === accountId)
            .map((user) => user.id);
          const deletedOrganizationIds = state.organizations
            .filter((organization) => organization.account_id === accountId)
            .map((organization) => organization.id);

          return {
            accounts: state.accounts.map((account) =>
              account.id === accountId
                ? { ...account, is_active: false, ...createSoftDeletePatch() }
                : account,
            ),
            users: state.users.map((user) =>
              user.account_id === accountId
                ? { ...user, ...createSoftDeletePatch() }
                : user,
            ),
            organizations: state.organizations.map((organization) =>
              organization.account_id === accountId
                ? {
                    ...organization,
                    is_active: false,
                    is_verified: false,
                    ...createSoftDeletePatch(),
                  }
                : organization,
            ),
            organizers: state.organizers.map((organizer) =>
              deletedUserIds.includes(organizer.user_id) ||
              deletedOrganizationIds.includes(organizer.organization_id)
                ? { ...organizer, ...createSoftDeletePatch() }
                : organizer,
            ),
          };
        }),

      addUser: (user) =>
        set((state) => ({
          users: [...state.users, user],
        })),

      updateUser: (userId, data) =>
        set((state) => ({
          users: state.users.map((user) =>
            user.id === userId ? { ...user, ...data, updated_at: now() } : user,
          ),
        })),

      deleteUser: (userId) =>
        set((state) => {
          const deletedUser = state.users.find((user) => user.id === userId);
          const accountId = deletedUser?.account_id;

          return {
            users: state.users.map((user) =>
              user.id === userId
                ? { ...user, ...createSoftDeletePatch() }
                : user,
            ),
            accounts: state.accounts.map((account) =>
              account.id === accountId
                ? { ...account, is_active: false, ...createSoftDeletePatch() }
                : account,
            ),
            organizers: state.organizers.map((organizer) =>
              organizer.user_id === userId
                ? { ...organizer, ...createSoftDeletePatch() }
                : organizer,
            ),
            favorites: state.favorites.map((favorite) =>
              favorite.user_id === userId
                ? { ...favorite, deleted_at: now() }
                : favorite,
            ),
            histories: state.histories.map((history) =>
              history.user_id === userId
                ? { ...history, deleted_at: now() }
                : history,
            ),
          };
        }),

      addOrganization: (organization) =>
        set((state) => ({
          organizations: [...state.organizations, organization],
        })),

      updateOrganization: (organizationId, data) =>
        set((state) => ({
          organizations: state.organizations.map((organization) =>
            organization.id === organizationId
              ? { ...organization, ...data, updated_at: now() }
              : organization,
          ),
        })),

      activateOrganization: (organizationId) =>
        set((state) => {
          const organization = state.organizations.find((item) => item.id === organizationId);

          return {
            organizations: state.organizations.map((item) =>
              item.id === organizationId
                ? {
                    ...item,
                    is_active: true,
                    is_verified: true,
                    updated_at: now(),
                  }
                : item,
            ),
            accounts: state.accounts.map((account) =>
              account.id === organization?.account_id
                ? { ...account, is_active: true, updated_at: now() }
                : account,
            ),
          };
        }),

      deleteOrganization: (organizationId) =>
        set((state) => {
          const deletedOrganization = state.organizations.find(
            (organization) => organization.id === organizationId,
          );
          const owningAccount = state.accounts.find(
            (account) => account.id === deletedOrganization?.account_id,
          );
          const shouldDeleteOwningAccount =
            owningAccount?.account_type === "organization";
          const deletedUserIds = shouldDeleteOwningAccount
            ? state.users
                .filter((user) => user.account_id === deletedOrganization?.account_id)
                .map((user) => user.id)
            : [];

          return {
            organizations: state.organizations.map((organization) =>
              organization.id === organizationId
                ? {
                    ...organization,
                    is_active: false,
                    is_verified: false,
                    ...createSoftDeletePatch(),
                  }
                : organization,
            ),
            accounts: state.accounts.map((account) =>
              shouldDeleteOwningAccount &&
              account.id === deletedOrganization?.account_id
                ? { ...account, is_active: false, ...createSoftDeletePatch() }
                : account,
            ),
            users: state.users.map((user) =>
              shouldDeleteOwningAccount &&
              user.account_id === deletedOrganization?.account_id
                ? { ...user, ...createSoftDeletePatch() }
                : user,
            ),
            organizers: state.organizers.map((organizer) =>
              organizer.organization_id === organizationId ||
              deletedUserIds.includes(organizer.user_id)
                ? { ...organizer, ...createSoftDeletePatch() }
                : organizer,
            ),
            events: state.events.map((event) =>
              event.organization_id === organizationId
                ? { ...event, is_active: false, ...createSoftDeletePatch() }
                : event,
            ),
            favorites: state.favorites.map((favorite) =>
              deletedUserIds.includes(favorite.user_id)
                ? { ...favorite, deleted_at: now() }
                : favorite,
            ),
            histories: state.histories.map((history) =>
              deletedUserIds.includes(history.user_id)
                ? { ...history, deleted_at: now() }
                : history,
            ),
          };
        }),

      addOrganizer: (organizer) =>
        set((state) => ({
          organizers: [...state.organizers, organizer],
        })),

      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, event],
        })),

      updateEvent: (eventId, data) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  ...data,
                  created_at: event.created_at,
                  updated_at: now(),
                }
              : event,
          ),
        })),

      approveEvent: (eventId) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  is_active: true,
                  suspended_until: null,
                  suspension_reason: null,
                  updated_at: now(),
                }
              : event,
          ),
        })),

      suspendEvent: (eventId, reason, suspendedUntil) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  suspended_until: suspendedUntil,
                  suspension_reason: reason,
                  updated_at: now(),
                }
              : event,
          ),
        })),

      liftEventSuspension: (eventId) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  suspended_until: null,
                  suspension_reason: null,
                  updated_at: now(),
                }
              : event,
          ),
        })),

      deleteEvent: (eventId) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  is_active: false,
                  ...createSoftDeletePatch(),
                }
              : event,
          ),
          favorites: state.favorites.map((favorite) =>
            favorite.event_id === eventId
              ? { ...favorite, deleted_at: now() }
              : favorite,
          ),
        })),

      restoreEvent: (eventId) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  deleted_at: null,
                  updated_at: now(),
                }
              : event,
          ),
        })),

      deleteEventPermanently: (eventId) =>
        set((state) => ({
          events: state.events.filter((event) => event.id !== eventId),
          favorites: state.favorites.filter(
            (favorite) => favorite.event_id !== eventId,
          ),
          histories: state.histories.filter(
            (history) => history.event_id !== eventId,
          ),
        })),

      addModerationDecision: (decision) =>
        set((state) => ({
          moderationDecisions: [
            {
              ...decision,
              id: createNextId(state.moderationDecisions),
              created_at: decision.created_at ?? now(),
            },
            ...state.moderationDecisions,
          ],
        })),

      addModerationReport: (report) => {
        const duplicateReport = get().moderationReports.find(
          (item) =>
            item.target_type === report.target_type &&
            item.target_id === report.target_id &&
            item.reporter_user_id === report.reporter_user_id &&
            (item.status === "open" || item.status === "reviewing"),
        );

        if (duplicateReport) return null;

        const createdAt = now();
        const moderationReport: ModerationReport = {
          id: createNextId(get().moderationReports),
          target_type: report.target_type,
          target_id: report.target_id,
          reporter_user_id: report.reporter_user_id,
          reason: report.reason,
          details: report.details,
          status: "open",
          priority: report.priority ?? "medium",
          created_at: createdAt,
          updated_at: createdAt,
          resolved_at: null,
          handled_by_user_id: null,
          resolution_note: null,
        };

        set((state) => ({
          moderationReports: [moderationReport, ...state.moderationReports],
        }));

        return moderationReport;
      },

      updateModerationReport: (reportId, data) =>
        set((state) => ({
          moderationReports: state.moderationReports.map((report) =>
            report.id === reportId
              ? {
                  ...report,
                  ...data,
                  updated_at: now(),
                }
              : report,
          ),
        })),

      suspendAccount: (accountId, reason, suspendedUntil) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  suspended_until: suspendedUntil,
                  suspension_reason: reason,
                  updated_at: now(),
                }
              : account,
          ),
        })),

      toggleFavorite: (userId, eventId) =>
        set((state) => {
          const existingFavorite = state.favorites.find(
            (favorite) =>
              favorite.user_id === userId && favorite.event_id === eventId,
          );

          if (existingFavorite) {
            return {
              favorites: state.favorites.map((favorite) =>
                favorite.id === existingFavorite.id
                  ? {
                      ...favorite,
                      deleted_at: favorite.deleted_at ? null : now(),
                    }
                  : favorite,
              ),
            };
          }

          return {
            favorites: [
              ...state.favorites,
              {
                id: Date.now(),
                user_id: userId,
                event_id: eventId,
                created_at: now(),
                deleted_at: null,
              },
            ],
          };
        }),

      recordHistory: (userId, eventId) =>
        set((state) => {
          const visitedAt = now();
          const existingHistory = state.histories.find(
            (history) =>
              history.user_id === userId &&
              history.event_id === eventId &&
              !history.deleted_at,
          );

          if (existingHistory) {
            return {
              histories: state.histories.map((history) =>
                history.user_id === userId &&
                history.event_id === eventId &&
                !history.deleted_at
                  ? { ...history, visited_at: visitedAt }
                  : history,
              ),
            };
          }

          return {
            histories: [
              ...state.histories,
              {
                id:
                  Math.max(0, ...state.histories.map((history) => history.id)) +
                  1,
                user_id: userId,
                event_id: eventId,
                visited_at: visitedAt,
                deleted_at: null,
              },
            ],
          };
        }),
      setUserEventPreferences: (userId, categories) =>
        set((state) => {
          const filtered = state.userEventPreferences.filter(
            (p) => p.user_id !== userId,
          );
          const uniqueCategories = Array.from(new Set(categories));

          const newPrefs: UserEventPreference[] = uniqueCategories.map(
            (cat, index) => ({
              id: Date.now() + index,
              user_id: userId,
              event_category_id: getEventCategoryId(cat),
            }),
          );
          return {
            userEventPreferences: [...filtered, ...newPrefs],
          };
        }),
    }),
    {
      name: "app-data-storage-v10",
      merge: (persistedState, currentState) => {
        const persistedData = persistedState as Partial<DataState> | undefined;

        if (!persistedData) return currentState;

        const persistedOrganizers = persistedData.organizers ?? [];
        const persistedOrganizerIds = new Set(
          persistedOrganizers.map((member) => member.id),
        );

        return {
          ...currentState,
          ...persistedData,
          organizers: [
            ...persistedOrganizers,
            ...organizersMock.filter(
              (member) => !persistedOrganizerIds.has(member.id),
            ),
          ],
        };
      },
    },
  ),
);

export default useDataStore;
