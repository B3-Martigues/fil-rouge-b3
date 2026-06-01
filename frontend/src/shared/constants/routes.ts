/**Centralisation des routes de l'application */

export const ROUTES = {
  PUBLIC: {
    HOME: "/",
    LOGIN: "/login",
    REGISTER: "/register",
    REGISTER_USER: "/register/user",
    REGISTER_COMPANY: "/register/company",
  },

  USER: {
    PROFILE: "/profile",
    FAVORITES: "/favorites",
    HISTORY: "/history",
    CHANGE_PASSWORD: "/profile/change-password",
    ONBOARDING_PREFERENCES: "onboarding/preferences",
    PREFERENCES: "/preferences",
  },

  ADMIN: {
    DASHBOARD: "/admin",
    EVENTS: "/admin/events",
    USERS: "/admin/users",
  },
  COMPANY: {
    DASHBOARD: "/company",
    EVENTS: "/company/events",
    CREATE: "/company/create",
    PROFILE: "/company/profile",
  },
} as const;
