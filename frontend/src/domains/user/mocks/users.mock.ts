import type { User, UserEventPreference } from "../types/user";
import { ROLE_IDS } from "../types/user";

export const usersMock: User[] = [
  {
    id: 1,
    account_id: 1,
    username: "Franceska",
    role_id: ROLE_IDS.user,
    role: "user",
    created_at: "2026-05-18T09:05:00.000Z",
    updated_at: "2026-05-18T09:05:00.000Z",
  },
  {
    id: 2,
    account_id: 2,
    username: "Admin",
    role_id: ROLE_IDS.admin,
    role: "admin",
    created_at: "2026-05-18T09:10:00.000Z",
    updated_at: "2026-05-18T09:10:00.000Z",
  },
  {
    id: 3,
    account_id: 3,
    username: "Luc",
    role_id: ROLE_IDS.user,
    role: "user",
    created_at: "2026-05-20T10:35:00.000Z",
    updated_at: "2026-05-20T10:35:00.000Z",
  },
  {
    id: 4,
    account_id: 4,
    username: "Compte inactif",
    role_id: ROLE_IDS.user,
    role: "user",
    created_at: "2026-05-21T14:05:00.000Z",
    updated_at: "2026-05-30T08:00:00.000Z",
  },
];

export const userEventPreferencesMock: UserEventPreference[] = [
  { id: 1, user_id: 1, event_category_id: 11, category_slug: "culture" },
  { id: 2, user_id: 1, event_category_id: 25, category_slug: "musique" },
  { id: 3, user_id: 1, event_category_id: 16, category_slug: "festival" },
  { id: 4, user_id: 1, event_category_id: 20, category_slug: "gastronomie" },
  { id: 5, user_id: 3, event_category_id: 37, category_slug: "sport" },
  { id: 6, user_id: 3, event_category_id: 26, category_slug: "nature" },
  { id: 7, user_id: 3, event_category_id: 38, category_slug: "technologie" },
];
