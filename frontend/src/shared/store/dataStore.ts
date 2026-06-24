import { create } from "zustand";
import { persist } from "zustand/middleware";

import { accountsMock } from "../../domains/auth/mocks/accounts.mock";
import { organizersMock } from "../../domains/organization/mocks/organizers.mock";
import { organizationsMock } from "../../domains/organization/mocks/organizations.mock";
import type { Organization } from "../../domains/organization/types/organization";
import type { Organizer } from "../../domains/organization/types/organizer";
import type { Event } from "../../domains/event/types/event";
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
import { notificationTypesMock } from "../../domains/notification/mocks/notification-types.mock";
import { getNotificationTypeConfig } from "../../domains/notification/mocks/notification-types.mock";
import {
  sendNotificationEmail,
  type EmailDeliveryResult,
} from "../../domains/notification/services/emailProviders";
import { createFavoriteEventTodayNotification } from "../../domains/notification/services/notificationFactory";
import type {
  Notification,
  NotificationDraft,
  NotificationType,
} from "../../domains/notification/types/notification";
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
} from "../../domains/event/types/event-categories";

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

type StaffDataSnapshot = {
  accounts: Account[];
  users: User[];
  organizations: Organization[];
  organizers: Organizer[];
  events: Event[];
  notificationTypes: NotificationType[];
  notifications: Notification[];
  moderationReports: ModerationReport[];
  moderationDecisions: ModerationDecision[];
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

  hydrateStaffSnapshot: (snapshot: StaffDataSnapshot) => void;
  getAccountSummaries: () => AccountSummary[];

  dispatchNotification: (
    notification: NotificationDraft,
  ) => Promise<Notification | null>;
  setUserNotifications: (userId: number, notifications: Notification[]) => void;
  upsertNotification: (notification: Notification) => void;
  markNotificationAsRead: (notificationId: number) => void;
  markUserNotificationsAsRead: (userId: number) => void;
  syncTodaysFavoriteEventNotifications: (userId: number) => void;

  addAccount: (account: Account) => void;
  updateAccount: (accountId: number, data: Partial<Account>) => void;
  deleteAccount: (accountId: number) => void;

  addUser: (user: User) => void;
  updateUser: (userId: number, data: Partial<User>) => void;
  deleteUser: (userId: number) => void;

  addOrganization: (organization: Organization) => void;
  upsertOrganizations: (organizations: Organization[]) => void;
  updateOrganization: (organizationId: number, data: Partial<Organization>) => void;
  activateOrganization: (organizationId: number) => void;
  deleteOrganization: (organizationId: number) => void;

  addOrganizer: (organizer: Organizer) => void;
  upsertOrganizers: (organizers: Organizer[]) => void;

  setEvents: (events: Event[]) => void;
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
  setUserFavorites: (userId: number, favorites: Favorite[]) => void;
  upsertFavorite: (favorite: Favorite) => void;
  recordHistory: (userId: number, eventId: number) => void;
  setUserHistories: (userId: number, histories: History[]) => void;
  upsertHistory: (history: History) => void;
  removeHistory: (userId: number, eventId: number) => void;
  removeHistoryById: (historyId: number) => void;
  setUserEventPreferences: (
    userId: number,
    categories: EventCategoryName[],
  ) => void;
};

const now = () => new Date().toISOString();
const shouldUsePersistedEvents =
  (import.meta.env.VITE_EVENTS_API_MODE ?? "http") !== "http";

const isNotDeleted = (record: { deleted_at?: string | null }) =>
  !record.deleted_at;

const createSoftDeletePatch = () => ({
  deleted_at: now(),
  updated_at: now(),
});

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const normalizeEvent = (event: Event): Event => {
  const legacyEvent = event as Event & {
    price?: unknown;
    ticketing_link?: unknown;
  };
  const price = Number(legacyEvent.price ?? 0);

  return {
    ...event,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    ticketing_link:
      typeof legacyEvent.ticketing_link === "string"
        ? legacyEvent.ticketing_link
        : "",
  };
};

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
      events: [],
      favorites: favoritesMock,
      histories: historiesMock,
      userEventPreferences: userEventPreferencesMock,
      notificationTypes: notificationTypesMock,
      notifications: [],
      notificationEmailDeliveries: [],
      moderationReports: moderationReportsMock,
      moderationDecisions: moderationDecisionsMock,

      hydrateStaffSnapshot: (snapshot) =>
        set(() => ({
          accounts: snapshot.accounts,
          users: snapshot.users,
          organizations: snapshot.organizations,
          organizers: snapshot.organizers,
          events: snapshot.events.map(normalizeEvent),
          notificationTypes: snapshot.notificationTypes,
          notifications: snapshot.notifications,
          moderationReports: snapshot.moderationReports,
          moderationDecisions: snapshot.moderationDecisions,
        })),

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

      setUserNotifications: (userId, notifications) =>
        set((state) => ({
          notifications: [
            ...state.notifications.filter(
              (notification) => notification.user_id !== userId,
            ),
            ...notifications,
          ],
        })),

      upsertNotification: (notification) =>
        set((state) => ({
          notifications: state.notifications.some(
            (item) => item.id === notification.id,
          )
            ? state.notifications.map((item) =>
                item.id === notification.id ? notification : item,
              )
            : [notification, ...state.notifications],
        })),

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

      upsertOrganizations: (organizations) =>
        set((state) => {
          const incomingIds = new Set(organizations.map((organization) => organization.id));
          const keptOrganizations = state.organizations.filter(
            (organization) => !incomingIds.has(organization.id),
          );

          return {
            organizations: [...keptOrganizations, ...organizations],
          };
        }),

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

      upsertOrganizers: (organizers) =>
        set((state) => {
          const incomingIds = new Set(organizers.map((organizer) => organizer.id));
          const keptOrganizers = state.organizers.filter(
            (organizer) => !incomingIds.has(organizer.id),
          );

          return {
            organizers: [...keptOrganizers, ...organizers],
          };
        }),

      setEvents: (events) =>
        set(() => ({
          events: events.map(normalizeEvent),
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
        const reporter = get().users.find(
          (user) =>
            user.id === report.reporter_user_id &&
            user.role === "user" &&
            !user.deleted_at,
        );
        const reporterAccount = reporter
          ? get().accounts.find(
              (account) =>
                account.id === reporter.account_id &&
                account.is_active &&
                !account.deleted_at,
            )
          : undefined;

        if (!reporter || !reporterAccount) return null;

        if (report.target_type === "event") {
          const targetEvent = get().events.find(
            (event) =>
              event.id === report.target_id &&
              event.is_active &&
              !event.deleted_at,
          );

          if (!targetEvent) return null;
        }

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

      setUserFavorites: (userId, favorites) =>
        set((state) => ({
          favorites: [
            ...state.favorites.filter((favorite) => favorite.user_id !== userId),
            ...favorites,
          ],
        })),

      upsertFavorite: (favorite) =>
        set((state) => ({
          favorites: state.favorites.some(
            (item) =>
              item.id === favorite.id ||
              (item.user_id === favorite.user_id &&
                item.event_id === favorite.event_id),
          )
            ? state.favorites.map((item) =>
                item.id === favorite.id ||
                (item.user_id === favorite.user_id &&
                  item.event_id === favorite.event_id)
                  ? favorite
                  : item,
              )
            : [...state.favorites, favorite],
        })),

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

      setUserHistories: (userId, histories) =>
        set((state) => ({
          histories: [
            ...state.histories.filter((history) => history.user_id !== userId),
            ...histories,
          ],
        })),

      upsertHistory: (history) =>
        set((state) => ({
          histories: state.histories.some(
            (item) =>
              item.id === history.id ||
              (item.user_id === history.user_id &&
                item.event_id === history.event_id &&
                !item.deleted_at),
          )
            ? state.histories.map((item) =>
                item.id === history.id ||
                (item.user_id === history.user_id &&
                  item.event_id === history.event_id &&
                  !item.deleted_at)
                  ? history
                  : item,
              )
            : [...state.histories, history],
        })),

      removeHistory: (userId, eventId) =>
        set((state) => ({
          histories: state.histories.map((history) =>
            history.user_id === userId &&
            history.event_id === eventId &&
            !history.deleted_at
              ? { ...history, deleted_at: now() }
              : history,
          ),
        })),

      removeHistoryById: (historyId) =>
        set((state) => ({
          histories: state.histories.map((history) =>
            history.id === historyId ? { ...history, deleted_at: now() } : history,
          ),
        })),

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
        const events = (
          shouldUsePersistedEvents
            ? persistedData.events ?? currentState.events
            : currentState.events
        ).map(normalizeEvent);

        return {
          ...currentState,
          ...persistedData,
          events,
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
