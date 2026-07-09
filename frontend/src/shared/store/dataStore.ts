import { create } from "zustand";

import type { Organization } from "../../domains/organization/types/organization";
import type { Organizer } from "../../domains/organization/types/organizer";
import type { Event } from "../../domains/event/types/event";
import { normalizeEventDateTimes } from "../../domains/event/utils/event";
import type {
  ModerationDecision,
  ModerationReport,
} from "../../domains/moderator/types/moderation";
import type {
  Notification,
  NotificationType,
} from "../../domains/notification/types/notification";
import type { Favorite } from "../../domains/user/types/favorite";
import type { History } from "../../domains/user/types/history";
import type {
  Account,
  AccountSummary,
  User,
  UserEventPreference,
} from "../../domains/user/types/user";
import { ROLE_IDS } from "../../domains/user/types/user";

type StaffDataSet = {
  summary: StaffSummary;
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

type StaffSummaryStat = {
  total: number;
  pending: number;
};

type StaffSummary = {
  accounts: StaffSummaryStat;
  events: StaffSummaryStat;
  organizations: StaffSummaryStat;
  reports: StaffSummaryStat;
};

type DataState = {
  staffSummary: StaffSummary;
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
  moderationReports: ModerationReport[];
  moderationDecisions: ModerationDecision[];

  clearStaffData: () => void;
  hydrateStaffData: (data: StaffDataSet) => void;
  getAccountSummaries: () => AccountSummary[];

  setUserNotifications: (userId: number, notifications: Notification[]) => void;
  setNotificationTypes: (notificationTypes: NotificationType[]) => void;
  upsertNotification: (notification: Notification) => void;
  markNotificationAsRead: (notificationId: number) => void;
  markUserNotificationsAsRead: (userId: number) => void;

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
  upsertEvents: (events: Event[]) => void;
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

  updateModerationReport: (
    reportId: number,
    data: Partial<Omit<ModerationReport, "id" | "created_at">>,
  ) => void;
  suspendAccount: (
    accountId: number,
    reason: string,
    suspendedUntil: string,
  ) => void;

  setUserFavorites: (userId: number, favorites: Favorite[]) => void;
  upsertFavorite: (favorite: Favorite) => void;
  setUserHistories: (userId: number, histories: History[]) => void;
  upsertHistory: (history: History) => void;
  removeHistory: (userId: number, eventId: number) => void;
  removeHistoryById: (historyId: number) => void;
  setUserEventPreferences: (
    userId: number,
    preferences: UserEventPreference[],
  ) => void;
};

const now = () => new Date().toISOString();

const isNotDeleted = (record: { deleted_at?: string | null }) =>
  !record.deleted_at;

const createSoftDeletePatch = () => ({
  deleted_at: now(),
  updated_at: now(),
});

const emptyStaffSummary = (): StaffSummary => ({
  accounts: { total: 0, pending: 0 },
  events: { total: 0, pending: 0 },
  organizations: { total: 0, pending: 0 },
  reports: { total: 0, pending: 0 },
});

const normalizeEvent = (event: Event): Event => {
  const legacyEvent = event as Event & {
    category_slugs?: unknown;
    external_image_url?: unknown;
    image?: unknown;
    image_optimized_url?: unknown;
    image_thumbnail_url?: unknown;
    organization_id?: unknown;
    price?: unknown;
    ticketing_link?: unknown;
  };
  const price = Number(legacyEvent.price ?? 0);
  const organizationId = Number(legacyEvent.organization_id ?? 0);
  const image =
    (typeof legacyEvent.image_optimized_url === "string" &&
      legacyEvent.image_optimized_url.trim()) ||
    (typeof legacyEvent.image === "string" && legacyEvent.image.trim()) ||
    (typeof legacyEvent.external_image_url === "string" &&
      legacyEvent.external_image_url.trim()) ||
    "";

  return {
    ...event,
    ...normalizeEventDateTimes(event),
    organization_id: Number.isFinite(organizationId) ? organizationId : 0,
    category_slugs: Array.isArray(legacyEvent.category_slugs)
      ? legacyEvent.category_slugs
      : [],
    image,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    ticketing_link:
      typeof legacyEvent.ticketing_link === "string"
        ? legacyEvent.ticketing_link
        : "",
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
    const organization = organizations.find(
      (item) => item.account_id === account.id && isNotDeleted(item),
    );

    if (organization) {
      const isOrganizationAccount =
        account.account_type === "organization" || user?.role === "organization";
      const role = isOrganizationAccount
        ? "organization"
        : (user?.role ?? account.account_type);
      return {
        account_id: account.id,
        login_email: account.login_email,
        role,
        role_id: isOrganizationAccount
          ? (organization.role_id ?? user?.role_id ?? ROLE_IDS.organization)
          : (user?.role_id ?? ROLE_IDS[role]),
        display_name: isOrganizationAccount
          ? organization.name
          : (user?.username ?? account.login_email),
        is_active: account.is_active && organization.is_active,
        suspended_until: account.suspended_until ?? null,
        suspension_reason: account.suspension_reason ?? null,
        user_id: user?.id,
        organization_id: organization.id,
        is_verified: organization.is_verified,
      };
    }

    const accountRole = user?.role ?? account.account_type;
    const roleId = user?.role_id ?? ROLE_IDS[accountRole] ?? ROLE_IDS.user;

    return {
      account_id: account.id,
      login_email: account.login_email,
      role: accountRole,
      role_id: roleId,
      display_name: user?.username ?? account.login_email,
      is_active: account.is_active,
      suspended_until: account.suspended_until ?? null,
      suspension_reason: account.suspension_reason ?? null,
      user_id: user?.id,
    };
  });

const useDataStore = create<DataState>()(
    (set, get) => ({
      staffSummary: emptyStaffSummary(),
      accounts: [],
      users: [],
      organizations: [],
      organizers: [],
      events: [],
      favorites: [],
      histories: [],
      userEventPreferences: [],
      notificationTypes: [],
      notifications: [],
      moderationReports: [],
      moderationDecisions: [],

      clearStaffData: () =>
        set(() => ({
          accounts: [],
          users: [],
          organizations: [],
          organizers: [],
          events: [],
          notificationTypes: [],
          notifications: [],
          moderationReports: [],
          moderationDecisions: [],
          staffSummary: emptyStaffSummary(),
        })),

      hydrateStaffData: (data) =>
        set(() => ({
          staffSummary: data.summary,
          accounts: data.accounts,
          users: data.users,
          organizations: data.organizations,
          organizers: data.organizers,
          events: data.events.map(normalizeEvent),
          notificationTypes: data.notificationTypes,
          notifications: data.notifications,
          moderationReports: data.moderationReports,
          moderationDecisions: data.moderationDecisions,
        })),

      getAccountSummaries: () =>
        buildAccountSummaries(get().accounts, get().users, get().organizations),

      setUserNotifications: (userId, notifications) =>
        set((state) => ({
          notifications: [
            ...state.notifications.filter(
              (notification) => notification.user_id !== userId,
            ),
            ...notifications,
          ],
        })),

      setNotificationTypes: (notificationTypes) =>
        set(() => ({
          notificationTypes,
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
          notifications: state.notifications.map((notification) =>
            notification.user_id === userId
              ? {
                  ...notification,
                  is_read: true,
                  read_at: notification.read_at ?? now(),
                }
              : notification,
          ),
        })),

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

      upsertEvents: (events) =>
        set((state) => {
          const incomingEvents = events.map(normalizeEvent);
          const incomingIds = new Set(incomingEvents.map((event) => event.id));

          return {
            events: [
              ...state.events.filter((event) => !incomingIds.has(event.id)),
              ...incomingEvents,
            ],
          };
        }),

      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, normalizeEvent(event)],
        })),

      updateEvent: (eventId, data) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId
              ? normalizeEvent({
                  ...event,
                  ...data,
                  created_at: event.created_at,
                  updated_at: now(),
                })
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

      setUserEventPreferences: (userId, preferences) =>
        set((state) => ({
          userEventPreferences: [
            ...state.userEventPreferences.filter((p) => p.user_id !== userId),
            ...preferences,
          ],
        })),
    }),
);

export default useDataStore;
