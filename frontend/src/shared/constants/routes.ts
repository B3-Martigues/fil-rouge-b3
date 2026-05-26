/**Centralisation des routes de l'application */

export const ROUTES = {
  PUBLIC: { HOME: "/", LOGIN: "/login", REGISTER: "/register" },

  USER: { PROFILE: "/profile", FAVORITES: "/favorites", HISTORY: "/history", CHANGE_PASSWORD: "/profile/change-password"  },

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
