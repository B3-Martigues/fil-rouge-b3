/**Centralisation des routes de l'application */

export const ROUTES = {
  PUBLIC: {
    HOME: "/",
    LOGIN: "/login",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password/:token",
    REGISTER: "/register",
  },

  USER: {
    PROFILE: "/profile",
    FAVORITES: "/favorites",
    HISTORY: "/history",
    NOTIFICATIONS: "/notifications",
    CHANGE_PASSWORD: "/profile/change-password",
    ONBOARDING: "/onboarding",
    PREFERENCES: "/preferences",
    ORGANIZATIONS: "/organizations",
    EVENTS: "/my-events",
    ORGANIZATION_DETAIL: "/organizations/:organizationId",
    BECOME_ORGANIZER: "/organizations/devenir-organisateur",
    CREATE_ORGANIZATION: "/organizations/new",
  },

  ADMIN: {
    DASHBOARD: "/admin",
    EVENTS: "/admin/events",
    USERS: "/admin/users",
  },
  MODERATOR: {
    DASHBOARD: "/moderator",
    EVENTS: "/moderator/events",
    ORGANIZATIONS: "/moderator/organizations",
    ACCOUNTS: "/moderator/accounts",
    REPORTS: "/moderator/reports",
  },
  ORGANIZATION: {
    DASHBOARD: "/organization",
    EVENTS: "/organization/events",
    CREATE: "/organization/create",
    PROFILE: "/organization/profile",
  },
} as const;
