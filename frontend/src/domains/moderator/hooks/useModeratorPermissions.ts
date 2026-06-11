import { useMemo } from "react";

import useAuthStore from "../../auth/store/authStore";
import {
  moderatorPermissions,
  moderatorProfilesMock,
  type ModeratorPermission,
} from "../mocks/moderators.mock";

export default function useModeratorPermissions() {
  const currentUser = useAuthStore((s) => s.currentUser);

  return useMemo(() => {
    if (currentUser?.role === "admin") {
      return {
        permissions: [...moderatorPermissions],
        can: () => true,
      };
    }

    const profile =
      currentUser?.role === "moderator"
        ? moderatorProfilesMock.find((item) => item.user_id === currentUser.user_id)
        : undefined;
    const permissions = profile?.permissions ?? [];

    return {
      permissions,
      can: (permission: ModeratorPermission) => permissions.includes(permission),
    };
  }, [currentUser]);
}
