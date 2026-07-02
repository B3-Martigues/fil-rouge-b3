import { useMemo } from "react";

import useAuthStore from "../../auth/store/authStore";

export const moderatorPermissions = [
  "review_events",
  "review_organizations",
  "moderate_events",
  "suspend_accounts",
  "manage_reports",
] as const;

export type ModeratorPermission = (typeof moderatorPermissions)[number];

export default function useModeratorPermissions() {
  const currentUser = useAuthStore((s) => s.currentUser);

  return useMemo(() => {
    if (currentUser?.role === "admin") {
      return {
        permissions: [...moderatorPermissions],
        can: () => true,
      };
    }

    const permissions =
      currentUser?.role === "moderator" ? [...moderatorPermissions] : [];

    return {
      permissions,
      can: (permission: ModeratorPermission) => permissions.includes(permission),
    };
  }, [currentUser]);
}
