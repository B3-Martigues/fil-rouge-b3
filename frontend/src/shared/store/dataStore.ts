import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usersMock } from "../../domains/auth/mocks/users.mock";
import { companiesMock } from "../../domains/company/mocks/companies.mock";
import { eventsMock } from "../../domains/events/mocks/events.mock";
import type { Event } from "../../domains/events/types/category";
import type { Company } from "../../domains/company/types/company";
import type { User } from "../../domains/user/types/user";

type DataState = {
  users: User[];
  companies: Company[];
  events: Event[];
  addUser: (user: User) => void;
  updateUser: (userId: number, data: Partial<User>) => void;
  deleteUser: (userId: number) => void;
  addCompany: (company: Company) => void;
  updateCompany: (companyId: number, data: Partial<Company>) => void;
  activateCompany: (companyId: number) => void;
  addEvent: (event: Event) => void;
  updateEvent: (eventId: number, data: Omit<Event, "id">) => void;
  deleteEvent: (eventId: number) => void;
};

const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      users: usersMock,
      companies: companiesMock,
      events: eventsMock,

      addUser: (user) =>
        set((state) => ({
          users: [...state.users, user],
        })),

      updateUser: (userId, data) =>
        set((state) => ({
          users: state.users.map((user) =>
            user.id === userId ? { ...user, ...data } : user,
          ),
          companies: state.companies.map((company) => {
            if (company.id !== userId) return company;

            return {
              ...company,
              name: data.username ?? company.name,
              email: data.email ?? company.email,
              is_active: data.is_active ?? company.is_active,
              is_verified: data.is_active ?? company.is_verified,
              updated_at: new Date().toISOString(),
            };
          }),
        })),

      deleteUser: (userId) =>
        set((state) => ({
          users: state.users.filter((user) => user.id !== userId),
          companies: state.companies.filter((company) => company.id !== userId),
        })),

      addCompany: (company) =>
        set((state) => ({
          companies: [...state.companies, company],
        })),

      updateCompany: (companyId, data) =>
        set((state) => ({
          companies: state.companies.map((company) =>
            company.id === companyId
              ? { ...company, ...data, updated_at: new Date().toISOString() }
              : company,
          ),
          users: state.users.map((user) => {
            if (user.id !== companyId) return user;

            return {
              ...user,
              username: data.name ?? user.username,
              email: data.email ?? user.email,
              is_active: data.is_active ?? user.is_active,
            };
          }),
        })),

      activateCompany: (companyId) =>
        set((state) => ({
          companies: state.companies.map((company) =>
            company.id === companyId
              ? {
                  ...company,
                  is_active: true,
                  is_verified: true,
                  updated_at: new Date().toISOString(),
                }
              : company,
          ),
          users: state.users.map((user) =>
            user.id === companyId ? { ...user, is_active: true } : user,
          ),
        })),

      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, event],
        })),

      updateEvent: (eventId, data) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId ? { id: eventId, ...data } : event,
          ),
        })),

      deleteEvent: (eventId) =>
        set((state) => ({
          events: state.events.filter((event) => event.id !== eventId),
        })),
    }),
    { name: "app-data-storage" },
  ),
);

export default useDataStore;
