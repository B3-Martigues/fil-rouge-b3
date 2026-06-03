import { create } from "zustand";
import { persist } from "zustand/middleware";

import { accountsMock } from "../../domains/auth/mocks/accounts.mock";
import {
  userEventPreferencesMock,
  usersMock,
} from "../../domains/user/mocks/users.mock";
import { companiesMock } from "../../domains/companies/mocks/companies.mock";
import { eventsMock } from "../../domains/events/mocks/events.mock";
import { favoritesMock } from "../../domains/user/mocks/favorites.mock";
import { historiesMock } from "../../domains/user/mocks/history.mock";
import type { Company } from "../../domains/companies/types/company";
import type { CompanyMember } from "../../domains/companies/types/company-member";
import type { Event } from "../../domains/events/types/event";
import type { Favorite } from "../../domains/user/types/favorite";
import type { History } from "../../domains/user/types/history";
import type {
  Account,
  AccountSummary,
  User,
  UserEventPreference,
} from "../../domains/user/types/user";
import { ROLE_IDS } from "../../domains/user/types/user";

type DataState = {
  accounts: Account[];
  users: User[];
  companies: Company[];
  companyMembers: CompanyMember[];
  events: Event[];
  favorites: Favorite[];
  histories: History[];
  userEventPreferences: UserEventPreference[];

  getAccountSummaries: () => AccountSummary[];

  addAccount: (account: Account) => void;
  updateAccount: (accountId: number, data: Partial<Account>) => void;
  deleteAccount: (accountId: number) => void;

  addUser: (user: User) => void;
  updateUser: (userId: number, data: Partial<User>) => void;
  deleteUser: (userId: number) => void;

  addCompany: (company: Company) => void;
  updateCompany: (companyId: number, data: Partial<Company>) => void;
  activateCompany: (companyId: number) => void;
  deleteCompany: (companyId: number) => void;

  addCompanyMember: (companyMember: CompanyMember) => void;

  addEvent: (event: Event) => void;
  updateEvent: (eventId: number, data: Partial<Omit<Event, "id" | "created_at">>) => void;
  approveEvent: (eventId: number) => void;
  deleteEvent: (eventId: number) => void;

  toggleFavorite: (userId: number, eventId: number) => void;
  recordHistory: (userId: number, eventId: number) => void;
};

const now = () => new Date().toISOString();

const isNotDeleted = (record: { deleted_at?: string | null }) =>
  !record.deleted_at;

export const buildAccountSummaries = (
  accounts: Account[],
  users: User[],
  companies: Company[],
): AccountSummary[] =>
  accounts.filter(isNotDeleted).map((account) => {
    const user = users.find(
      (item) => item.account_id === account.id && isNotDeleted(item),
    );
    const company = companies.find(
      (item) => item.account_id === account.id && isNotDeleted(item),
    );

    if (company) {
      return {
        account_id: account.id,
        login_email: account.login_email,
        password_hash: account.password_hash,
        role: "company",
        role_id: company.role_id ?? ROLE_IDS.company,
        display_name: company.name,
        is_active: account.is_active && company.is_active,
        user_id: user?.id,
        company_id: company.id,
        is_verified: company.is_verified,
      };
    }

    return {
      account_id: account.id,
      login_email: account.login_email,
      password_hash: account.password_hash,
      role: user?.role ?? "user",
      role_id: user?.role_id ?? ROLE_IDS.user,
      display_name: user?.username ?? account.login_email,
      is_active: account.is_active,
      user_id: user?.id,
    };
  });

const createSoftDeletePatch = () => ({
  deleted_at: now(),
  updated_at: now(),
});

const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      accounts: accountsMock,
      users: usersMock,
      companies: companiesMock,
      companyMembers: [],
      events: eventsMock,
      favorites: favoritesMock,
      histories: historiesMock,
      userEventPreferences: userEventPreferencesMock,

      getAccountSummaries: () =>
        buildAccountSummaries(get().accounts, get().users, get().companies),

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
          const deletedCompanyIds = state.companies
            .filter((company) => company.account_id === accountId)
            .map((company) => company.id);

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
            companies: state.companies.map((company) =>
              company.account_id === accountId
                ? {
                    ...company,
                    is_active: false,
                    is_verified: false,
                    ...createSoftDeletePatch(),
                  }
                : company,
            ),
            companyMembers: state.companyMembers.map((companyMember) =>
              deletedUserIds.includes(companyMember.user_id) ||
              deletedCompanyIds.includes(companyMember.company_id)
                ? { ...companyMember, ...createSoftDeletePatch() }
                : companyMember,
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
              user.id === userId ? { ...user, ...createSoftDeletePatch() } : user,
            ),
            accounts: state.accounts.map((account) =>
              account.id === accountId
                ? { ...account, is_active: false, ...createSoftDeletePatch() }
                : account,
            ),
            companyMembers: state.companyMembers.map((companyMember) =>
              companyMember.user_id === userId
                ? { ...companyMember, ...createSoftDeletePatch() }
                : companyMember,
            ),
            favorites: state.favorites.map((favorite) =>
              favorite.user_id === userId ? { ...favorite, deleted_at: now() } : favorite,
            ),
            histories: state.histories.map((history) =>
              history.user_id === userId ? { ...history, deleted_at: now() } : history,
            ),
          };
        }),

      addCompany: (company) =>
        set((state) => ({
          companies: [...state.companies, company],
        })),

      updateCompany: (companyId, data) =>
        set((state) => ({
          companies: state.companies.map((company) =>
            company.id === companyId
              ? { ...company, ...data, updated_at: now() }
              : company,
          ),
        })),

      activateCompany: (companyId) =>
        set((state) => {
          const company = state.companies.find((item) => item.id === companyId);

          return {
            companies: state.companies.map((item) =>
              item.id === companyId
                ? {
                    ...item,
                    is_active: true,
                    is_verified: true,
                    updated_at: now(),
                  }
                : item,
            ),
            accounts: state.accounts.map((account) =>
              account.id === company?.account_id
                ? { ...account, is_active: true, updated_at: now() }
                : account,
            ),
          };
        }),

      deleteCompany: (companyId) =>
        set((state) => {
          const deletedCompany = state.companies.find(
            (company) => company.id === companyId,
          );
          const deletedUserIds = state.users
            .filter((user) => user.account_id === deletedCompany?.account_id)
            .map((user) => user.id);

          return {
            companies: state.companies.map((company) =>
              company.id === companyId
                ? {
                    ...company,
                    is_active: false,
                    is_verified: false,
                    ...createSoftDeletePatch(),
                  }
                : company,
            ),
            accounts: state.accounts.map((account) =>
              account.id === deletedCompany?.account_id
                ? { ...account, is_active: false, ...createSoftDeletePatch() }
                : account,
            ),
            users: state.users.map((user) =>
              user.account_id === deletedCompany?.account_id
                ? { ...user, ...createSoftDeletePatch() }
                : user,
            ),
            companyMembers: state.companyMembers.map((companyMember) =>
              companyMember.company_id === companyId ||
              deletedUserIds.includes(companyMember.user_id)
                ? { ...companyMember, ...createSoftDeletePatch() }
                : companyMember,
            ),
            events: state.events.map((event) =>
              event.company_id === companyId
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

      addCompanyMember: (companyMember) =>
        set((state) => ({
          companyMembers: [...state.companyMembers, companyMember],
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
                  Math.max(0, ...state.histories.map((history) => history.id)) + 1,
                user_id: userId,
                event_id: eventId,
                visited_at: visitedAt,
                deleted_at: null,
              },
            ],
          };
        }),
    }),
    { name: "app-data-storage-v4" },
  ),
);

export default useDataStore;
