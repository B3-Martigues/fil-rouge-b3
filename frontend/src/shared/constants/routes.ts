/**Centralisation des routes de l'application */

export const ROUTES = {
  PUBLIC: {
    HOME: "/",
    LOGIN: "/login",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password/:token",
    REGISTER: "/register",
    REGISTER_USER: "/register/user",
    REGISTER_COMPANY: "/register/company",
  },

  USER: {
    PROFILE: "/profile",
    FAVORITES: "/favorites",
    HISTORY: "/history",
    CHANGE_PASSWORD: "/profile/change-password",
    ONBOARDING: "/onboarding",
    PREFERENCES: "/preferences",
  },

  ADMIN: {
    DASHBOARD: "/admin",
    EVENTS: "/admin/events",
    USERS: "/admin/users",
  },
  MODERATOR: {
    DASHBOARD: "/moderator",
    EVENTS: "/moderator/events",
    COMPANIES: "/moderator/companies",
    ACCOUNTS: "/moderator/accounts",
    REPORTS: "/moderator/reports",
  },
  COMPANY: {
    DASHBOARD: "/company",
    EVENTS: "/company/events",
    CREATE: "/company/create",
    PROFILE: "/company/profile",
  },
} as const;
